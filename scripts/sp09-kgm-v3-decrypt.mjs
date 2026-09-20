import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const MAX_INPUT_BYTES = 128 * 1024 * 1024;
const KGM_MAGIC = Buffer.from('7cd532eb86027f4ba8afa68e0fff9914', 'hex');
const V3_SLOT_KEYS = new Map([[1, Buffer.from('6c2c2f27', 'hex')]]);

function argValue(args, name) {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}

function requireArgument(args, name) {
  const value = argValue(args, name);
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
}

function kugouMd5(bytes) {
  const digest = createHash('md5').update(bytes).digest();
  const result = Buffer.alloc(16);
  for (let i = 0; i < 16; i += 2) {
    result[i] = digest[14 - i];
    result[i + 1] = digest[15 - i];
  }
  return result;
}

function xorCollapse(index) {
  return (index ^ (index >>> 8) ^ (index >>> 16) ^ (index >>> 24)) & 0xff;
}

function decryptChunk(chunk, fileBox, slotBox, offset) {
  const output = Buffer.from(chunk);
  for (let i = 0; i < output.length; i += 1) {
    const position = offset + i;
    let value = output[i] ^ fileBox[position % fileBox.length];
    value ^= (value << 4) & 0xff;
    value ^= slotBox[position % slotBox.length];
    value ^= xorCollapse(position);
    output[i] = value & 0xff;
  }
  return output;
}

async function hashFile(filePath) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

const args = process.argv.slice(2);
const inputPath = path.resolve(requireArgument(args, '--input'));
const outputRoot = path.resolve(argValue(args, '--output-dir') ?? path.join(os.tmpdir(), 'unas-sp09-kgm-v3'));
const jsonOnly = args.includes('--json');
const inputInfo = await stat(inputPath);
if (!inputInfo.isFile()) throw new Error('input must be a regular file');
if (inputInfo.size > MAX_INPUT_BYTES) throw new Error('input exceeds the 128 MiB local probe budget');

const headerHandle = await open(inputPath, 'r');
const headerBuffer = Buffer.alloc(64);
let headerBytes;
try {
  ({ bytesRead: headerBytes } = await headerHandle.read(headerBuffer, 0, headerBuffer.length, 0));
} finally {
  await headerHandle.close();
}
const header = headerBuffer.subarray(0, headerBytes);
if (header.length < 60 || !header.subarray(0, 16).equals(KGM_MAGIC)) {
  throw new Error('input is not a KGM file with the expected magic');
}
const audioOffset = header.readUInt32LE(16);
const version = header.readUInt32LE(20);
const cryptoSlot = header.readUInt32LE(24);
if (version !== 3) throw new Error(`only KGM v3 is supported by this probe; found v${version}`);
if (audioOffset < 60 || audioOffset >= inputInfo.size) throw new Error('audio offset is outside the input');
const slotKey = V3_SLOT_KEYS.get(cryptoSlot);
if (!slotKey) throw new Error(`unsupported KGM v3 crypto slot ${cryptoSlot}`);

const fileBox = Buffer.concat([kugouMd5(header.subarray(44, 60)), Buffer.from([0x6b])]);
const slotBox = kugouMd5(slotKey);
await mkdir(outputRoot, { recursive: true });
const outputPath = path.join(outputRoot, `${path.basename(inputPath)}.decrypted.flac`);
if (path.resolve(outputPath) === inputPath) throw new Error('refusing to overwrite input');

let offset = 0;
let firstBytes = Buffer.alloc(0);
try {
  const decrypting = new Transform({
    transform(chunk, _encoding, callback) {
      const output = decryptChunk(chunk, fileBox, slotBox, offset);
      offset += output.length;
      if (firstBytes.length < 4) firstBytes = Buffer.concat([firstBytes, output]).subarray(0, 4);
      callback(null, output);
    },
  });
  await pipeline(createReadStream(inputPath, { start: audioOffset }), decrypting, createWriteStream(outputPath, { flags: 'wx' }));
  if (!firstBytes.equals(Buffer.from('fLaC', 'ascii'))) {
    await rm(outputPath, { force: true });
    throw new Error(`decrypted output does not start with FLAC magic: ${firstBytes.toString('hex')}`);
  }
} catch (error) {
  await rm(outputPath, { force: true });
  throw error;
}

const outputInfo = await stat(outputPath);
const report = {
  schemaVersion: 1,
  status: 'verified',
  algorithm: 'KGM-v3-local',
  inputPath,
  inputBytes: inputInfo.size,
  inputSha256: await hashFile(inputPath),
  audioOffset,
  cryptoVersion: version,
  cryptoSlot,
  outputPath,
  outputBytes: outputInfo.size,
  outputSha256: await hashFile(outputPath),
  outputMagic: firstBytes.toString('ascii'),
  sourcePolicy: 'local-user-provided-input; output-not-in-repository',
};

if (jsonOnly) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`SP-09 KGM v3 decrypt: ${report.status}`);
  console.log(`input=${report.inputBytes} bytes sha256=${report.inputSha256}`);
  console.log(`output=${report.outputBytes} bytes sha256=${report.outputSha256}`);
  console.log(`magic=${report.outputMagic} offset=${report.audioOffset} slot=${report.cryptoSlot}`);
  console.log(`outputPath=${report.outputPath}`);
}
