import { createDecipheriv, createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const MAX_INPUT_BYTES = 128 * 1024 * 1024;
const MAX_SECTION_BYTES = 16 * 1024 * 1024;
const NCM_MAGIC = Buffer.from('CTENFDAM', 'ascii');
const CORE_KEY = Buffer.from('hzHRAms o5kIn baxW'.replaceAll(' ', ''), 'ascii');
const META_KEY = Buffer.from([0x23, 0x31, 0x34, 0x6c, 0x6a, 0x6b, 0x5f, 0x21, 0x5c, 0x5d, 0x26, 0x30, 0x55, 0x3c, 0x27, 0x28]);

function argValue(args, name) {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}

function requireArgument(args, name) {
  const value = argValue(args, name);
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
}

function unpadPkcs7(bytes) {
  if (bytes.length === 0) throw new Error('PKCS#7 input is empty');
  const count = bytes.at(-1);
  if (count < 1 || count > 16 || count > bytes.length) throw new Error('invalid PKCS#7 padding');
  for (const value of bytes.subarray(bytes.length - count)) {
    if (value !== count) throw new Error('invalid PKCS#7 padding');
  }
  return bytes.subarray(0, bytes.length - count);
}

function aes128Ecb(bytes, key) {
  if (bytes.length === 0 || bytes.length % 16 !== 0) throw new Error('AES-ECB input must be a non-empty block sequence');
  const decipher = createDecipheriv('aes-128-ecb', key, null);
  decipher.setAutoPadding(false);
  return Buffer.concat([decipher.update(bytes), decipher.final()]);
}

function decodeAudioKey(encrypted) {
  const xor = Buffer.from(encrypted);
  for (let i = 0; i < xor.length; i += 1) xor[i] ^= 0x64;
  const plain = unpadPkcs7(aes128Ecb(xor, CORE_KEY));
  if (plain.length <= 17) throw new Error('NCM audio key payload is truncated');
  return plain.subarray(17);
}

function decodeMetadata(encrypted) {
  if (encrypted.length === 0) return { type: '', value: undefined };
  if (encrypted.length <= 22) throw new Error('NCM metadata payload is truncated');
  const xor = Buffer.from(encrypted.subarray(22));
  for (let i = 0; i < xor.length; i += 1) xor[i] ^= 0x63;
  const decoded = Buffer.from(xor.toString('ascii'), 'base64');
  const plain = unpadPkcs7(aes128Ecb(decoded, META_KEY));
  const separator = plain.indexOf(0x3a);
  if (separator < 0) throw new Error('NCM metadata type separator is missing');
  const type = plain.subarray(0, separator).toString('utf8');
  let value;
  try {
    value = JSON.parse(plain.subarray(separator + 1).toString('utf8'));
  } catch {
    value = undefined;
  }
  return { type, value };
}

function buildKeyBox(key) {
  if (key.length === 0) throw new Error('NCM audio key is empty');
  const box = Uint8Array.from({ length: 256 }, (_, index) => index);
  let j = 0;
  for (let i = 0; i < 256; i += 1) {
    j = (j + box[i] + key[i % key.length]) & 0xff;
    [box[i], box[j]] = [box[j], box[i]];
  }
  const result = Buffer.alloc(256);
  for (let i = 0; i < 256; i += 1) {
    const a = box[(i + 1) & 0xff];
    const b = box[(i + 1 + a) & 0xff];
    result[i] = box[(a + b) & 0xff];
  }
  return result;
}

function decryptAudioChunk(chunk, box, offset) {
  const output = Buffer.from(chunk);
  for (let i = 0; i < output.length; i += 1) output[i] ^= box[(offset + i) & 0xff];
  return output;
}

async function readAt(handle, offset, length) {
  const buffer = Buffer.alloc(length);
  const { bytesRead } = await handle.read(buffer, 0, length, offset);
  if (bytesRead !== length) throw new Error(`unexpected EOF at ${offset}; expected ${length}, got ${bytesRead}`);
  return buffer;
}

async function hashFile(filePath) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

function detectOutput(buffer) {
  if (buffer.subarray(0, 4).equals(Buffer.from('fLaC', 'ascii'))) return { format: 'flac', magic: 'fLaC' };
  if (buffer.subarray(0, 3).equals(Buffer.from('ID3', 'ascii'))) return { format: 'mp3', magic: 'ID3' };
  if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return { format: 'mp3', magic: buffer.subarray(0, 2).toString('hex') };
  return { format: 'unknown', magic: buffer.subarray(0, 4).toString('hex') };
}

const args = process.argv.slice(2);
const inputPath = path.resolve(requireArgument(args, '--input'));
const outputRoot = path.resolve(argValue(args, '--output-dir') ?? path.join(os.tmpdir(), 'unas-sp09-ncm'));
const jsonOnly = args.includes('--json');
const inputInfo = await stat(inputPath);
if (!inputInfo.isFile()) throw new Error('input must be a regular file');
if (inputInfo.size > MAX_INPUT_BYTES) throw new Error('input exceeds the 128 MiB local probe budget');

const handle = await open(inputPath, 'r');
let keyData;
let metadata;
let audioOffset;
try {
  const magic = await readAt(handle, 0, 8);
  if (!magic.equals(NCM_MAGIC)) throw new Error('input is not an NCM file');
  const keyLength = (await readAt(handle, 10, 4)).readUInt32LE();
  if (keyLength > MAX_SECTION_BYTES) throw new Error('NCM key section exceeds the 16 MiB budget');
  keyData = decodeAudioKey(await readAt(handle, 14, keyLength));

  const metaLengthOffset = 14 + keyLength;
  const metaLength = (await readAt(handle, metaLengthOffset, 4)).readUInt32LE();
  if (metaLength > MAX_SECTION_BYTES) throw new Error('NCM metadata section exceeds the 16 MiB budget');
  metadata = decodeMetadata(await readAt(handle, metaLengthOffset + 4, metaLength));

  const coverFrameLengthOffset = metaLengthOffset + 4 + metaLength + 5;
  const coverFrameLength = (await readAt(handle, coverFrameLengthOffset, 4)).readUInt32LE();
  const coverLength = (await readAt(handle, coverFrameLengthOffset + 4, 4)).readUInt32LE();
  if (coverFrameLength > MAX_SECTION_BYTES || coverLength > MAX_SECTION_BYTES) {
    throw new Error('NCM cover section exceeds the 16 MiB budget');
  }
  // The frame length includes the cover-length field and cover payload.
  audioOffset = coverFrameLengthOffset + 8 + coverFrameLength;
  if (audioOffset >= inputInfo.size) throw new Error('NCM audio payload is empty or truncated');
} finally {
  await handle.close();
}

const keyBox = buildKeyBox(keyData);
const expectedFormat = typeof metadata.value?.format === 'string' ? metadata.value.format.toLowerCase() : '';
const outputExtension = expectedFormat === 'mp3' || expectedFormat === 'flac' ? expectedFormat : 'audio';
await mkdir(outputRoot, { recursive: true });
const outputPath = path.join(outputRoot, `${path.basename(inputPath)}.decrypted.${outputExtension}`);
let offset = 0;
let firstBytes = Buffer.alloc(0);
try {
  const decrypting = new Transform({
    transform(chunk, _encoding, callback) {
      const output = decryptAudioChunk(chunk, keyBox, offset);
      offset += output.length;
      if (firstBytes.length < 16) firstBytes = Buffer.concat([firstBytes, output]).subarray(0, 16);
      callback(null, output);
    },
  });
  await pipeline(createReadStream(inputPath, { start: audioOffset }), decrypting, createWriteStream(outputPath, { flags: 'wx' }));
  const outputDetection = detectOutput(firstBytes);
  if (outputDetection.format === 'unknown') {
    await rm(outputPath, { force: true });
    throw new Error(`decrypted output has an unknown audio signature: ${outputDetection.magic}`);
  }
} catch (error) {
  await rm(outputPath, { force: true });
  throw error;
}

const outputInfo = await stat(outputPath);
const outputDetection = detectOutput(firstBytes);
const report = {
  schemaVersion: 1,
  status: 'verified',
  algorithm: 'NCM-local',
  inputPath,
  inputBytes: inputInfo.size,
  inputSha256: await hashFile(inputPath),
  audioOffset,
  metadataType: metadata.type,
  metadataFormat: expectedFormat || undefined,
  outputPath,
  outputBytes: outputInfo.size,
  outputSha256: await hashFile(outputPath),
  outputFormat: outputDetection.format,
  outputMagic: outputDetection.magic,
  sourcePolicy: 'local-user-provided-input; remote-cover-url-not-fetched; output-not-in-repository',
};

if (jsonOnly) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`SP-09 NCM decrypt: ${report.status}`);
  console.log(`input=${report.inputBytes} bytes sha256=${report.inputSha256}`);
  console.log(`output=${report.outputBytes} bytes sha256=${report.outputSha256}`);
  console.log(`format=${report.outputFormat} magic=${report.outputMagic} offset=${report.audioOffset}`);
  console.log(`outputPath=${report.outputPath}`);
}
