import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(repoRoot, 'benchmarks', 'sp-09', 'fixtures', 'manifest.json');
const MAX_INPUT_BYTES = 128 * 1024 * 1024;
const MAX_SECTION_BYTES = 16 * 1024 * 1024;
const MAX_QMC_FOOTER_BYTES = 64 * 1024;

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function jsonSha256(value) {
  return sha256(Buffer.from(JSON.stringify(value)));
}

function u32le(bytes, offset) {
  return bytes.readUInt32LE(offset);
}

function makeKgm(fixture) {
  const magic = Buffer.from('7cd532eb86027f4ba8afa68e0fff9914', 'hex');
  const audioOffset = fixture.audioOffset;
  const headerLength = fixture.version === 5 ? 128 : 64;
  const bytes = Buffer.alloc(Math.max(headerLength, Math.min(audioOffset + 8, headerLength)), 0);
  magic.copy(bytes, 0);
  bytes.writeUInt32LE(audioOffset >>> 0, 16);
  bytes.writeUInt32LE(fixture.version, 20);
  bytes.writeUInt32LE(1, 24);
  Buffer.from('sp09-test-data-1', 'ascii').copy(bytes, 28);
  Buffer.from('sp09-test-key-01', 'ascii').copy(bytes, 44);
  if (fixture.version === 5) {
    bytes.writeUInt32LE(0, 60);
    bytes.writeUInt32LE(0, 64);
    const hash = Buffer.from(fixture.audioHash ?? '', 'ascii');
    bytes.writeUInt32LE(hash.length, 68);
    hash.copy(bytes, 72);
  }
  Buffer.from('ID3SP09', 'ascii').copy(bytes, audioOffset);
  return bytes;
}

function makeNcm(fixture) {
  const parts = [Buffer.from('CTENFDAM', 'ascii'), Buffer.alloc(2)];
  const keyLength = fixture.keyLength ?? 16;
  const key = Buffer.alloc(Math.min(keyLength, MAX_SECTION_BYTES), 0x64);
  const length = Buffer.alloc(4);
  length.writeUInt32LE(keyLength >>> 0);
  parts.push(length, key, Buffer.alloc(4));
  parts.push(Buffer.alloc(5));
  parts.push(Buffer.alloc(4));
  parts.push(Buffer.alloc(4));
  parts.push(Buffer.from('ID3SP09', 'ascii'));
  return Buffer.concat(parts);
}

function makeQmcQTag() {
  const body = Buffer.from('ID3SP09-QMC-BODY', 'ascii');
  const metadata = Buffer.from('synthetic-key,123,456', 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(metadata.length);
  return Buffer.concat([body, metadata, length, Buffer.from('QTag', 'ascii')]);
}

function makeQmcStatic() {
  return Buffer.from('encrypted-qmc-static-vector-without-footer', 'ascii');
}

function makeUnknown() {
  return Buffer.from('not-a-supported-container', 'ascii');
}

async function getFixtureBytes(fixture, moduleDir) {
  switch (fixture.builder) {
    case 'kgm':
      return makeKgm(fixture);
    case 'ncm':
      return makeNcm(fixture);
    case 'qmc-qtag':
      return makeQmcQTag();
    case 'qmc-static':
      return makeQmcStatic();
    case 'unknown':
      return makeUnknown();
    default:
      if (!moduleDir || !fixture.source) {
        throw new Error(`module dir is required for ${fixture.id}`);
      }
      return Buffer.concat([
        await readFile(path.join(moduleDir, fixture.source.raw)),
        await readFile(path.join(moduleDir, fixture.source.suffix)),
      ]);
  }
}

function result(status, format, variant, reason, extra = {}) {
  return { status, format, variant, reason, ...extra };
}

function probeKgm(bytes) {
  const kgm = Buffer.from('7cd532eb86027f4ba8afa68e0fff9914', 'hex');
  const vpr = Buffer.from('0528bc96e9e45a4391aabdd07af53631', 'hex');
  if (!bytes.subarray(0, 16).equals(kgm) && !bytes.subarray(0, 16).equals(vpr)) return null;
  if (bytes.length < 60) return result('unsupported', 'KGM', 'unknown', 'header is truncated');
  const audioOffset = u32le(bytes, 16);
  const version = u32le(bytes, 20);
  if (audioOffset > MAX_INPUT_BYTES) {
    return result('unsupported', 'KGM', 'unknown', 'audio offset exceeds input budget');
  }
  if (version !== 3 && version !== 5) {
    return result('unsupported', 'KGM', 'unknown', `unsupported crypto version ${version}`);
  }
  if (audioOffset > bytes.length) {
    return result('unsupported', 'KGM', `v${version}`, 'audio offset is outside the input');
  }
  if (version === 5) {
    if (bytes.length < 72) return result('unsupported', 'KGM', 'v5', 'v5 hash header is truncated');
    const hashLength = u32le(bytes, 68);
    if (hashLength > MAX_SECTION_BYTES || 72 + hashLength > bytes.length) {
      return result('unsupported', 'KGM', 'v5', 'audio hash section exceeds resource budget');
    }
    return result('verified', 'KGM', 'v5', 'KGM magic and bounded v5 header; external KGG resource is recorded', {
      externalResource: 'KGG database',
    });
  }
  return result('verified', 'KGM', 'v3', 'KGM magic and bounded v3 header');
}

function probeNcm(bytes) {
  if (!bytes.subarray(0, 8).equals(Buffer.from('CTENFDAM', 'ascii'))) return null;
  let offset = 10;
  if (bytes.length < offset + 4) return result('unsupported', 'NCM', 'unknown', 'key length is truncated');
  const keyLength = u32le(bytes, offset);
  offset += 4;
  if (keyLength > MAX_SECTION_BYTES) return result('unsupported', 'NCM', 'unknown', 'NCM section exceeds resource budget');
  if (offset + keyLength + 4 > bytes.length) return result('unsupported', 'NCM', 'unknown', 'key section is truncated');
  offset += keyLength;
  const metaLength = u32le(bytes, offset);
  offset += 4;
  if (metaLength > MAX_SECTION_BYTES) return result('unsupported', 'NCM', 'unknown', 'metadata section exceeds resource budget');
  if (offset + metaLength + 5 + 8 > bytes.length) return result('unsupported', 'NCM', 'unknown', 'metadata/cover header is truncated');
  offset += metaLength + 5;
  const coverFrameLength = u32le(bytes, offset);
  offset += 4;
  const coverLength = u32le(bytes, offset);
  if (coverFrameLength > MAX_SECTION_BYTES || coverLength > MAX_SECTION_BYTES) {
    return result('unsupported', 'NCM', 'unknown', 'cover section exceeds resource budget');
  }
  if (offset + 4 + coverLength > bytes.length) return result('unsupported', 'NCM', 'unknown', 'cover section is truncated');
  return result('verified', 'NCM', 'container-structure', 'NCM magic and bounded section lengths');
}

function probeQmc(bytes) {
  if (bytes.length < 4) return null;
  const suffix = bytes.subarray(-4).toString('ascii');
  if (suffix === 'STag') return result('unsupported', 'QMC', 'STag', "STag has no media key");
  if (suffix === 'QTag') {
    if (bytes.length < 8) return result('unsupported', 'QMC', 'QTag', 'QTag footer is truncated');
    const metadataLength = bytes.readUInt32BE(bytes.length - 8);
    if (metadataLength > MAX_QMC_FOOTER_BYTES || metadataLength + 8 > bytes.length) {
      return result('unsupported', 'QMC', 'QTag', 'QTag metadata exceeds resource budget');
    }
    return result('verified', 'QMC', 'QTag', 'QTag footer has bounded metadata length');
  }
  if (suffix === 'cex\0') {
    if (bytes.length < 16) return result('unsupported', 'QMC', 'MusicEx', 'MusicEx footer is truncated');
    const tagSize = bytes.readUInt32LE(bytes.length - 16);
    const version = bytes.readUInt32LE(bytes.length - 12);
    if (version !== 1 || tagSize < 0xc0 || tagSize > MAX_QMC_FOOTER_BYTES || tagSize + 16 > bytes.length) {
      return result('unsupported', 'QMC', 'MusicEx', 'MusicEx footer is invalid or exceeds resource budget');
    }
    return result('verified', 'QMC', 'MusicEx', 'MusicEx footer has bounded tag length');
  }
  const keyLength = bytes.readUInt32LE(bytes.length - 4);
  if (keyLength > 0 && keyLength <= MAX_QMC_FOOTER_BYTES && keyLength + 4 <= bytes.length) {
    return result('verified', 'QMC', 'raw-key-footer', 'raw key footer has bounded key length');
  }
  return result('unsupported', 'unknown', 'unknown', 'no extension-independent QMC marker');
}

function probe(bytes) {
  if (bytes.length > MAX_INPUT_BYTES) return result('unsupported', 'unknown', 'unknown', 'input exceeds resource budget');
  return probeKgm(bytes) ?? probeNcm(bytes) ?? probeQmc(bytes) ?? result('unsupported', 'unknown', 'unknown', 'magic/container not recognized');
}

const args = process.argv.slice(2);
const moduleFlag = args.indexOf('--module-dir');
const moduleDir = moduleFlag >= 0 ? args[moduleFlag + 1] : undefined;
const jsonOnly = args.includes('--json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const rows = [];

for (const fixture of manifest.fixtures) {
  const bytes = await getFixtureBytes(fixture, moduleDir);
  const actual = probe(bytes);
  const expectedComparable = {
    status: actual.status,
    format: actual.format,
    variant: actual.variant,
    reason: actual.reason,
  };
  const expectedHash = jsonSha256(fixture.expected);
  const actualHash = jsonSha256(expectedComparable);
  let expectedOutputSha256;
  if (fixture.source?.expectedOutput && moduleDir) {
    expectedOutputSha256 = sha256(await readFile(path.join(moduleDir, fixture.source.expectedOutput)));
  }
  rows.push({
    id: fixture.id,
    kind: fixture.kind,
    inputBytes: bytes.length,
    inputSha256: sha256(bytes),
    expectedResultSha256: expectedHash,
    actualResultSha256: actualHash,
    expectedOutputSha256,
    actual,
    pass: expectedHash === actualHash,
  });
}

const summary = {
  schemaVersion: 1,
  limits: {
    maxInputBytes: MAX_INPUT_BYTES,
    maxSectionBytes: MAX_SECTION_BYTES,
    maxQmcFooterBytes: MAX_QMC_FOOTER_BYTES,
  },
  rows,
  passed: rows.filter((row) => row.pass).length,
  total: rows.length,
};

if (jsonOnly) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log(`SP-09 MD-02 probe: ${summary.passed}/${summary.total} passed`);
  for (const row of rows) {
    console.log(`${row.pass ? 'PASS' : 'FAIL'} ${row.id} ${row.actual.status}/${row.actual.format}/${row.actual.variant} input=${row.inputSha256}`);
  }
  console.log(JSON.stringify(summary.limits));
}

if (summary.passed !== summary.total) process.exitCode = 1;
