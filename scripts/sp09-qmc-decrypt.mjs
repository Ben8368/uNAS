import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, rename, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const MAX_INPUT_BYTES = 128 * 1024 * 1024;
const MAX_FOOTER_BYTES = 64 * 1024;
const QTAG = Buffer.from('QTag', 'ascii');
const STAG = Buffer.from('STag', 'ascii');
const CEX_TAG = Buffer.from('cex\x00', 'binary');
const RAW_KEY_PREFIX_V2 = Buffer.from('QQMusic EncV2,Key:', 'ascii');
const DERIVE_V2_KEY_1 = Buffer.from([
  0x33, 0x38, 0x36, 0x5a, 0x4a, 0x59, 0x21, 0x40,
  0x23, 0x2a, 0x24, 0x25, 0x5e, 0x26, 0x29, 0x28,
]);
const DERIVE_V2_KEY_2 = Buffer.from([
  0x2a, 0x2a, 0x23, 0x21, 0x28, 0x23, 0x24, 0x25,
  0x26, 0x5e, 0x61, 0x31, 0x63, 0x5a, 0x2c, 0x54,
]);

function argValue(args, name) {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}

function requireArgument(args, name) {
  const value = argValue(args, name);
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
}

function xorBytes(a, b) {
  const result = Buffer.alloc(a.length);
  for (let i = 0; i < a.length; i += 1) result[i] = a[i] ^ b[i];
  return result;
}

function teaDecryptBlock(input, key) {
  let v0 = input.readUInt32BE(0);
  let v1 = input.readUInt32BE(4);
  const k0 = key.readUInt32BE(0);
  const k1 = key.readUInt32BE(4);
  const k2 = key.readUInt32BE(8);
  const k3 = key.readUInt32BE(12);
  const delta = 0x9e3779b9;
  let sum = Math.imul(0x9e3779b9, 16) >>> 0;
  for (let round = 0; round < 16; round += 1) {
    const mix1 = (Math.imul(v0, 16) + k2) ^ ((v0 + sum) >>> 0) ^ ((v0 >>> 5) + k3);
    v1 = (v1 - mix1) >>> 0;
    const mix0 = (Math.imul(v1, 16) + k0) ^ ((v1 + sum) >>> 0) ^ ((v1 >>> 5) + k1);
    v0 = (v0 - mix0) >>> 0;
    sum = (sum - delta) >>> 0;
  }
  const output = Buffer.alloc(8);
  output.writeUInt32BE(v0, 0);
  output.writeUInt32BE(v1, 4);
  return output;
}

function decryptTencentTea(input, key) {
  if (input.length < 16 || input.length % 8 !== 0) {
    throw new Error('QMC TEA input must be at least 16 bytes and aligned to 8 bytes');
  }
  let block = teaDecryptBlock(input.subarray(0, 8), key);
  const padding = block[0] & 0x07;
  const outputLength = input.length - 1 - padding - 2 - 7;
  if (outputLength < 0) throw new Error('QMC TEA payload is truncated');

  let ivPrevious = Buffer.alloc(8);
  let ivCurrent = input.subarray(0, 8);
  let inputOffset = 8;
  let blockOffset = 1 + padding;
  const output = Buffer.alloc(outputLength);
  let outputOffset = 0;

  const decryptNextBlock = () => {
    if (inputOffset + 8 > input.length) throw new Error('QMC TEA block is truncated');
    ivPrevious = ivCurrent;
    ivCurrent = input.subarray(inputOffset, inputOffset + 8);
    block = teaDecryptBlock(xorBytes(block, ivCurrent), key);
    inputOffset += 8;
    blockOffset = 0;
  };

  const nextPlainByte = () => {
    if (blockOffset === 8) decryptNextBlock();
    const value = block[blockOffset] ^ ivPrevious[blockOffset];
    blockOffset += 1;
    return value;
  };

  for (let i = 0; i < 2; i += 1) nextPlainByte();
  while (outputOffset < output.length) output[outputOffset++] = nextPlainByte();
  // Match the reference implementation's final zero sentinel check. The
  // sentinel starts at the current block offset and is not part of output.
  if (blockOffset === 8) decryptNextBlock();
  for (let i = 0; i < 7; i += 1) {
    if ((block[blockOffset] ^ ivPrevious[blockOffset]) !== 0) throw new Error('QMC TEA zero check failed');
  }
  return output;
}

function simpleMakeKey(salt, length) {
  const key = Buffer.alloc(length);
  for (let i = 0; i < length; i += 1) key[i] = Math.abs(Math.tan(salt + i * 0.1)) * 100;
  return key;
}

function deriveKeyV2(raw) {
  const first = decryptTencentTea(raw, DERIVE_V2_KEY_1);
  const second = decryptTencentTea(first, DERIVE_V2_KEY_2);
  return Buffer.from(second.toString('ascii'), 'base64');
}

function deriveKey(rawKey) {
  const decoded = Buffer.from(rawKey.toString('ascii'), 'base64');
  if (decoded.length < 16) throw new Error('QMC raw key is too short after base64 decoding');
  const keyMaterial = decoded.subarray(0, RAW_KEY_PREFIX_V2.length).equals(RAW_KEY_PREFIX_V2)
    ? deriveKeyV2(decoded.subarray(RAW_KEY_PREFIX_V2.length))
    : decoded;
  if (keyMaterial.length < 16) throw new Error('QMC derived key material is too short');
  const simpleKey = simpleMakeKey(106, 8);
  const teaKey = Buffer.alloc(16);
  for (let i = 0; i < 8; i += 1) {
    teaKey[i * 2] = simpleKey[i];
    teaKey[i * 2 + 1] = keyMaterial[i];
  }
  return Buffer.concat([keyMaterial.subarray(0, 8), decryptTencentTea(keyMaterial.subarray(8), teaKey)]);
}

function rotate(value, bits) {
  const amount = (bits + 4) % 8;
  return ((value << amount) | (value >>> amount)) & 0xff;
}

function decryptMap(input, key, offset) {
  const output = Buffer.from(input);
  for (let i = 0; i < output.length; i += 1) {
    let position = offset + i;
    if (position > 0x7fff) position %= 0x7fff;
    const index = (position * position + 71214) % key.length;
    output[i] ^= rotate(key[index], index & 0x07);
  }
  return output;
}

function buildRc4(key) {
  const box = Buffer.alloc(key.length);
  for (let i = 0; i < key.length; i += 1) box[i] = i;
  let j = 0;
  for (let i = 0; i < key.length; i += 1) {
    j = (j + box[i] + key[i % key.length]) % key.length;
    [box[i], box[j]] = [box[j], box[i]];
  }
  let hash = 1;
  for (const value of key) {
    if (value === 0) continue;
    const nextHash = Math.imul(hash, value) >>> 0;
    if (nextHash === 0 || nextHash <= hash) break;
    hash = nextHash;
  }
  return { box, key, hash };
}

function getSegmentSkip(cipher, id) {
  const seed = cipher.key[id % cipher.key.length];
  if (seed === 0) return 0;
  return Math.trunc((cipher.hash / ((id + 1) * seed)) * 100) % cipher.key.length;
}

function decryptRc4Segment(input, cipher, offset) {
  const output = Buffer.from(input);
  const box = Buffer.from(cipher.box);
  let j = 0;
  let k = 0;
  const skip = (offset % 5120) + getSegmentSkip(cipher, Math.floor(offset / 5120));
  for (let i = -skip; i < output.length; i += 1) {
    j = (j + 1) % cipher.key.length;
    k = (box[j] + k) % cipher.key.length;
    [box[j], box[k]] = [box[k], box[j]];
    if (i >= 0) output[i] ^= box[(box[j] + box[k]) % cipher.key.length];
  }
  return output;
}

function decryptRc4(input, cipher, offset) {
  const output = Buffer.from(input);
  let remaining = output.length;
  let processed = 0;
  const mark = (count) => {
    offset += count;
    remaining -= count;
    processed += count;
  };
  if (offset < 128) {
    const count = Math.min(remaining, 128 - offset);
    for (let i = 0; i < count; i += 1) output[i] ^= cipher.key[getSegmentSkip(cipher, offset + i)];
    mark(count);
    if (remaining === 0) return output;
  }
  if (offset % 5120 !== 0) {
    const count = Math.min(remaining, 5120 - (offset % 5120));
    const decoded = decryptRc4Segment(output.subarray(processed, processed + count), cipher, offset);
    decoded.copy(output, processed);
    mark(count);
    if (remaining === 0) return output;
  }
  while (remaining > 5120) {
    const decoded = decryptRc4Segment(output.subarray(processed, processed + 5120), cipher, offset);
    decoded.copy(output, processed);
    mark(5120);
  }
  if (remaining > 0) {
    const decoded = decryptRc4Segment(output.subarray(processed), cipher, offset);
    decoded.copy(output, processed);
  }
  return output;
}

function decryptChunk(input, key, offset) {
  if (key.length > 300) return decryptRc4(input, buildRc4(key), offset);
  if (key.length > 0) return decryptMap(input, key, offset);
  return Buffer.from(input);
}

async function hashFile(filePath) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

function detectOutput(buffer) {
  if (buffer.subarray(0, 4).equals(Buffer.from('OggS', 'ascii'))) return { format: 'ogg', magic: 'OggS' };
  if (buffer.subarray(0, 4).equals(Buffer.from('fLaC', 'ascii'))) return { format: 'flac', magic: 'fLaC' };
  if (buffer.subarray(0, 3).equals(Buffer.from('ID3', 'ascii'))) return { format: 'mp3', magic: 'ID3' };
  if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return { format: 'mp3', magic: buffer.subarray(0, 2).toString('hex') };
  if (buffer.subarray(0, 4).equals(Buffer.from('RIFF', 'ascii'))) return { format: 'wav', magic: 'RIFF' };
  return { format: 'unknown', magic: buffer.subarray(0, 4).toString('hex') };
}

async function readAt(handle, offset, length) {
  const buffer = Buffer.alloc(length);
  const { bytesRead } = await handle.read(buffer, 0, length, offset);
  if (bytesRead !== length) throw new Error(`unexpected EOF at ${offset}; expected ${length}, got ${bytesRead}`);
  return buffer;
}

async function locateAudio(handle, fileSize) {
  if (fileSize < 4) throw new Error('QMC input is shorter than its footer marker');
  const suffix = await readAt(handle, fileSize - 4, 4);
  if (suffix.equals(STAG)) throw new Error("QMC 'STag' footer has no media key");
  if (suffix.equals(CEX_TAG)) throw new Error("QMC 'cex\\0' footer requires an external MMKV key and is unsupported");
  if (suffix.equals(QTAG)) {
    if (fileSize < 8) throw new Error('QMC QTag footer is truncated');
    const metadataLength = (await readAt(handle, fileSize - 8, 4)).readUInt32BE();
    if (metadataLength > MAX_FOOTER_BYTES) throw new Error('QMC QTag footer exceeds the 64 KiB budget');
    const rawMeta = await readAt(handle, fileSize - 8 - metadataLength, metadataLength);
    const items = rawMeta.toString('utf8').split(',');
    if (items.length !== 3) throw new Error('QMC QTag metadata is invalid');
    return { audioLength: fileSize - 8 - metadataLength, rawKey: Buffer.from(items[0], 'ascii'), footer: 'QTag' };
  }
  const keyLength = suffix.readUInt32LE();
  if (keyLength > 0 && keyLength <= MAX_FOOTER_BYTES) {
    const audioLength = fileSize - 4 - keyLength;
    if (audioLength <= 0) throw new Error('QMC raw-key footer leaves no audio payload');
    const rawKey = await readAt(handle, audioLength, keyLength);
    let rawKeyLength = rawKey.length;
    while (rawKeyLength > 0 && rawKey[rawKeyLength - 1] === 0) rawKeyLength -= 1;
    return { audioLength, rawKey: Buffer.from(rawKey.subarray(0, rawKeyLength).toString('ascii'), 'ascii'), footer: 'raw-key' };
  }
  return { audioLength: fileSize, rawKey: Buffer.alloc(0), footer: 'static' };
}

const args = process.argv.slice(2);
const inputPath = path.resolve(requireArgument(args, '--input'));
const outputRoot = path.resolve(argValue(args, '--output-dir') ?? path.join(os.tmpdir(), 'unas-sp09-qmc'));
const jsonOnly = args.includes('--json');
const inputInfo = await stat(inputPath);
if (!inputInfo.isFile()) throw new Error('input must be a regular file');
if (inputInfo.size > MAX_INPUT_BYTES) throw new Error('input exceeds the 128 MiB local probe budget');

const handle = await open(inputPath, 'r');
let located;
let key;
try {
  located = await locateAudio(handle, inputInfo.size);
  key = located.rawKey.length > 0 ? deriveKey(located.rawKey) : Buffer.alloc(0);
} finally {
  await handle.close();
}

const cipherKind = key.length > 300 ? 'rc4' : key.length > 0 ? 'map' : 'static';
await mkdir(outputRoot, { recursive: true });
let outputPath = path.join(outputRoot, `${path.basename(inputPath)}.decrypted.audio`);
let offset = 0;
let firstBytes = Buffer.alloc(0);
try {
  const decrypting = new Transform({
    transform(chunk, _encoding, callback) {
      try {
        const output = decryptChunk(chunk, key, offset);
        offset += output.length;
        if (firstBytes.length < 16) firstBytes = Buffer.concat([firstBytes, output]).subarray(0, 16);
        callback(null, output);
      } catch (error) {
        callback(error);
      }
    },
  });
  await pipeline(createReadStream(inputPath, { start: 0, end: located.audioLength - 1 }), decrypting, createWriteStream(outputPath, { flags: 'wx' }));
  const outputDetection = detectOutput(firstBytes);
  if (outputDetection.format === 'unknown') {
    await rm(outputPath, { force: true });
    throw new Error(`decrypted output has an unknown audio signature: ${outputDetection.magic}`);
  }
  const detectedOutputPath = path.join(outputRoot, `${path.basename(inputPath)}.decrypted.${outputDetection.format}`);
  try {
    await stat(detectedOutputPath);
    throw new Error(`refusing to overwrite existing output: ${detectedOutputPath}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await rename(outputPath, detectedOutputPath);
  outputPath = detectedOutputPath;
} catch (error) {
  await rm(outputPath, { force: true });
  throw error;
}

const outputInfo = await stat(outputPath);
const outputDetection = detectOutput(firstBytes);
const report = {
  schemaVersion: 1,
  status: 'verified',
  algorithm: 'QMC-local',
  inputPath,
  inputBytes: inputInfo.size,
  inputSha256: await hashFile(inputPath),
  footer: located.footer,
  audioBytes: located.audioLength,
  derivedKeyBytes: key.length,
  cipher: cipherKind,
  outputPath,
  outputBytes: outputInfo.size,
  outputSha256: await hashFile(outputPath),
  outputFormat: outputDetection.format,
  outputMagic: outputDetection.magic,
  sourcePolicy: 'local-user-provided-input; no-external-key-or-network; output-not-in-repository',
};

if (jsonOnly) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`SP-09 QMC decrypt: ${report.status}`);
  console.log(`input=${report.inputBytes} bytes sha256=${report.inputSha256}`);
  console.log(`output=${report.outputBytes} bytes sha256=${report.outputSha256}`);
  console.log(`footer=${report.footer} cipher=${report.cipher} format=${report.outputFormat} audioBytes=${report.audioBytes}`);
  console.log(`outputPath=${report.outputPath}`);
}
