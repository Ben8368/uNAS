import { MUSIC_LIMITS } from './types'

const KGM_MAGIC = new Uint8Array([0x7c, 0xd5, 0x32, 0xeb, 0x86, 0x02, 0x7f, 0x4b, 0xa8, 0xaf, 0xa6, 0x8e, 0x0f, 0xff, 0x99, 0x14])
const KGM_V3_SLOT_KEY = new Uint8Array([0x6c, 0x2c, 0x2f, 0x27])
const NCM_MAGIC = new TextEncoder().encode('CTENFDAM')
const CORE_KEY = new TextEncoder().encode('hzHRAms o5kIn baxW'.replaceAll(' ', ''))
const META_KEY = new Uint8Array([0x23, 0x31, 0x34, 0x6c, 0x6a, 0x6b, 0x5f, 0x21, 0x5c, 0x5d, 0x26, 0x30, 0x55, 0x3c, 0x27, 0x28])
const RAW_KEY_PREFIX_V2 = new TextEncoder().encode('QQMusic EncV2,Key:')
const DERIVE_V2_KEY_1 = new Uint8Array([0x33, 0x38, 0x36, 0x5a, 0x4a, 0x59, 0x21, 0x40, 0x23, 0x2a, 0x24, 0x25, 0x5e, 0x26, 0x29, 0x28])
const DERIVE_V2_KEY_2 = new Uint8Array([0x2a, 0x2a, 0x23, 0x21, 0x28, 0x23, 0x24, 0x25, 0x26, 0x5e, 0x61, 0x31, 0x63, 0x5a, 0x2c, 0x54])

export type KgmHeader = { audioOffset: number; version: number; slot: number }
export type KgmCipher = { fileBox: Uint8Array; slotBox: Uint8Array }
export type NcmHeader = { audioOffset: number; keyBox: Uint8Array; metadataFormat?: string }
export type QmcFooter = { audioBytes: number; rawKey: Uint8Array; footer: 'raw-key' | 'qtag' | 'static' }
export type QmcCipher = { kind: 'map' | 'rc4' | 'static'; key: Uint8Array; box?: Uint8Array; hash?: number }

function sameBytes(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) return false
  return true
}

function concatBytes(...parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(total)
  let offset = 0
  for (const part of parts) { result.set(part, offset); offset += part.length }
  return result
}

function xorBytes(left: Uint8Array, right: Uint8Array) {
  const result = new Uint8Array(left.length)
  for (let index = 0; index < left.length; index += 1) result[index] = left[index] ^ right[index]
  return result
}

function readUint32LE(bytes: Uint8Array, offset: number) {
  return (bytes[offset] | bytes[offset + 1] << 8 | bytes[offset + 2] << 16 | bytes[offset + 3] * 0x1000000) >>> 0
}

function readUint32BE(bytes: Uint8Array, offset: number) {
  return (bytes[offset] * 0x1000000 + bytes[offset + 1] * 0x10000 + bytes[offset + 2] * 0x100 + bytes[offset + 3]) >>> 0
}

function writeUint32BE(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = value >>> 24
  bytes[offset + 1] = value >>> 16
  bytes[offset + 2] = value >>> 8
  bytes[offset + 3] = value
}

function unpadPkcs7(bytes: Uint8Array) {
  if (bytes.length === 0) throw new Error('invalid padding')
  const count = bytes[bytes.length - 1]
  if (count < 1 || count > 16 || count > bytes.length) throw new Error('invalid padding')
  for (let index = bytes.length - count; index < bytes.length; index += 1) if (bytes[index] !== count) throw new Error('invalid padding')
  return bytes.subarray(0, bytes.length - count)
}

// AES-128 is kept local because WebCrypto does not expose AES-ECB, which is
// part of the NCM container format. This is only used for local container keys.
const SBOX = new Uint8Array([
  0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
  0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
  0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
  0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
  0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
  0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
  0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
  0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
  0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
  0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
  0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
  0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
  0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
  0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
  0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
  0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16,
])
const INV_SBOX = new Uint8Array(256)
for (let index = 0; index < SBOX.length; index += 1) INV_SBOX[SBOX[index]] = index
const RCON = new Uint8Array([0, 1, 2, 4, 8, 16, 32, 64, 128, 27, 54])

function expandAesKey(key: Uint8Array) {
  if (key.length !== 16) throw new Error('AES key must be 16 bytes')
  const expanded = new Uint8Array(176)
  expanded.set(key)
  let generated = 16
  let round = 1
  const temp = new Uint8Array(4)
  while (generated < expanded.length) {
    temp.set(expanded.subarray(generated - 4, generated))
    if (generated % 16 === 0) {
      const first = temp[0]
      temp[0] = SBOX[temp[1]] ^ RCON[round]
      temp[1] = SBOX[temp[2]]
      temp[2] = SBOX[temp[3]]
      temp[3] = SBOX[first]
      round += 1
    }
    for (let index = 0; index < 4; index += 1) { expanded[generated] = expanded[generated - 16] ^ temp[index]; generated += 1 }
  }
  return expanded
}

function xtime(value: number) {
  return ((value << 1) ^ ((value & 0x80) ? 0x1b : 0)) & 0xff
}

function multiply(a: number, b: number) {
  let result = 0
  for (let index = 0; index < 8; index += 1) {
    if (b & 1) result ^= a
    a = xtime(a); b >>>= 1
  }
  return result
}

function addRoundKey(state: Uint8Array, keys: Uint8Array, offset: number) {
  for (let index = 0; index < 16; index += 1) state[index] ^= keys[offset + index]
}

function invShiftRows(state: Uint8Array) {
  const copy = state.slice()
  for (let row = 0; row < 4; row += 1) for (let column = 0; column < 4; column += 1) state[row + column * 4] = copy[row + ((column - row + 4) % 4) * 4]
}

function invSubBytes(state: Uint8Array) { for (let index = 0; index < 16; index += 1) state[index] = INV_SBOX[state[index]] }

function invMixColumns(state: Uint8Array) {
  for (let column = 0; column < 4; column += 1) {
    const offset = column * 4
    const a = state[offset]; const b = state[offset + 1]; const c = state[offset + 2]; const d = state[offset + 3]
    state[offset] = multiply(a, 14) ^ multiply(b, 11) ^ multiply(c, 13) ^ multiply(d, 9)
    state[offset + 1] = multiply(a, 9) ^ multiply(b, 14) ^ multiply(c, 11) ^ multiply(d, 13)
    state[offset + 2] = multiply(a, 13) ^ multiply(b, 9) ^ multiply(c, 14) ^ multiply(d, 11)
    state[offset + 3] = multiply(a, 11) ^ multiply(b, 13) ^ multiply(c, 9) ^ multiply(d, 14)
  }
}

function aesDecryptBlock(block: Uint8Array, keys: Uint8Array) {
  const state = block.slice()
  addRoundKey(state, keys, 160)
  for (let round = 9; round > 0; round -= 1) {
    invShiftRows(state); invSubBytes(state); addRoundKey(state, keys, round * 16); invMixColumns(state)
  }
  invShiftRows(state); invSubBytes(state); addRoundKey(state, keys, 0)
  return state
}

export function aes128Ecb(bytes: Uint8Array, key: Uint8Array) {
  if (bytes.length === 0 || bytes.length % 16 !== 0) throw new Error('AES input is not block aligned')
  const keys = expandAesKey(key)
  const output = new Uint8Array(bytes.length)
  for (let offset = 0; offset < bytes.length; offset += 16) output.set(aesDecryptBlock(bytes.subarray(offset, offset + 16), keys), offset)
  return output
}

function decodeBase64(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function ascii(bytes: Uint8Array) { return new TextDecoder('ascii').decode(bytes) }
function utf8(bytes: Uint8Array) { return new TextDecoder().decode(bytes) }

export function parseKgmHeader(header: Uint8Array): KgmHeader {
  if (header.length < 28 || !sameBytes(header.subarray(0, 16), KGM_MAGIC)) throw new Error('输入不是可识别的 KGM 文件')
  const result = { audioOffset: readUint32LE(header, 16), version: readUint32LE(header, 20), slot: readUint32LE(header, 24) }
  if (result.version !== 3) throw new Error(`当前浏览器路径只支持 KGM v3，检测到 v${result.version}`)
  if (result.slot !== 1) throw new Error(`不支持 KGM v3 crypto slot ${result.slot}`)
  if (result.audioOffset < 60) throw new Error('KGM 音频偏移无效')
  return result
}

function md5(bytes: Uint8Array) {
  const shifts = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21]
  const constants = Array.from({ length: 64 }, (_, index) => Math.floor(Math.abs(Math.sin(index + 1)) * 0x100000000) >>> 0)
  const paddedLength = ((bytes.length + 9 + 63) >> 6) << 6
  const padded = new Uint8Array(paddedLength)
  padded.set(bytes); padded[bytes.length] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(paddedLength - 8, bytes.length * 8 >>> 0, true)
  view.setUint32(paddedLength - 4, Math.floor(bytes.length / 0x20000000), true)
  let a0 = 0x67452301; let b0 = 0xefcdab89; let c0 = 0x98badcfe; let d0 = 0x10325476
  for (let offset = 0; offset < padded.length; offset += 64) {
    const words = new Uint32Array(16)
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4, true)
    let a = a0; let b = b0; let c = c0; let d = d0
    for (let index = 0; index < 64; index += 1) {
      let f: number; let wordIndex: number
      if (index < 16) { f = (b & c) | (~b & d); wordIndex = index }
      else if (index < 32) { f = (d & b) | (~d & c); wordIndex = (5 * index + 1) % 16 }
      else if (index < 48) { f = b ^ c ^ d; wordIndex = (3 * index + 5) % 16 }
      else { f = c ^ (b | ~d); wordIndex = (7 * index) % 16 }
      const value = (a + f + constants[index] + words[wordIndex]) >>> 0
      const rotated = (value << shifts[index]) | (value >>> (32 - shifts[index]))
      a = d; d = c; c = b; b = (b + rotated) >>> 0
    }
    a0 = (a0 + a) >>> 0; b0 = (b0 + b) >>> 0; c0 = (c0 + c) >>> 0; d0 = (d0 + d) >>> 0
  }
  const digest = new Uint8Array(16); const output = new DataView(digest.buffer)
  output.setUint32(0, a0, true); output.setUint32(4, b0, true); output.setUint32(8, c0, true); output.setUint32(12, d0, true)
  return digest
}

function kugouMd5(bytes: Uint8Array) {
  const digest = md5(bytes); const result = new Uint8Array(16)
  for (let index = 0; index < 16; index += 2) { result[index] = digest[14 - index]; result[index + 1] = digest[15 - index] }
  return result
}

export function createKgmCipher(header: Uint8Array): KgmCipher {
  return { fileBox: concatBytes(kugouMd5(header.subarray(44, 60)), new Uint8Array([0x6b])), slotBox: kugouMd5(KGM_V3_SLOT_KEY) }
}

export function decryptKgmChunk(chunk: Uint8Array, cipher: KgmCipher, offset: number) {
  const output = chunk.slice()
  for (let index = 0; index < output.length; index += 1) {
    const position = offset + index
    let value = output[index] ^ cipher.fileBox[position % cipher.fileBox.length]
    value ^= (value << 4) & 0xff
    value ^= cipher.slotBox[position % cipher.slotBox.length]
    value ^= position ^ position >>> 8 ^ position >>> 16 ^ position >>> 24
    output[index] = value & 0xff
  }
  return output
}

export function parseNcmKey(encrypted: Uint8Array) {
  const xor = encrypted.slice(); for (let index = 0; index < xor.length; index += 1) xor[index] ^= 0x64
  const plain = unpadPkcs7(aes128Ecb(xor, CORE_KEY))
  if (plain.length <= 17) throw new Error('NCM 音频 key 区段截断')
  return plain.subarray(17)
}

export function parseNcmMetadata(encrypted: Uint8Array) {
  if (encrypted.length === 0) return undefined
  if (encrypted.length <= 22) throw new Error('NCM metadata 区段截断')
  const xor = encrypted.subarray(22).slice(); for (let index = 0; index < xor.length; index += 1) xor[index] ^= 0x63
  const plain = unpadPkcs7(aes128Ecb(decodeBase64(ascii(xor)), META_KEY))
  const separator = plain.indexOf(0x3a)
  if (separator < 0) throw new Error('NCM metadata 类型缺失')
  const type = utf8(plain.subarray(0, separator))
  try {
    const value = JSON.parse(utf8(plain.subarray(separator + 1))) as { format?: unknown }
    return { type, format: typeof value.format === 'string' ? value.format.toLowerCase() : undefined }
  } catch { return { type, format: undefined } }
}

export function buildNcmKeyBox(key: Uint8Array) {
  if (key.length === 0) throw new Error('NCM 音频 key 为空')
  const box = Uint8Array.from({ length: 256 }, (_, index) => index)
  let j = 0
  for (let index = 0; index < 256; index += 1) { j = (j + box[index] + key[index % key.length]) & 0xff; [box[index], box[j]] = [box[j], box[index]] }
  const result = new Uint8Array(256)
  for (let index = 0; index < 256; index += 1) { const a = box[(index + 1) & 0xff]; const b = box[(index + 1 + a) & 0xff]; result[index] = box[(a + b) & 0xff] }
  return result
}

export function decryptNcmChunk(chunk: Uint8Array, box: Uint8Array, offset: number) {
  const output = chunk.slice(); for (let index = 0; index < output.length; index += 1) output[index] ^= box[(offset + index) & 0xff]
  return output
}

export function parseNcmHeader(bytes: Uint8Array, fileSize: number): NcmHeader {
  if (!sameBytes(bytes.subarray(0, 8), NCM_MAGIC)) throw new Error('输入不是可识别的 NCM 文件')
  const keyLength = readUint32LE(bytes, 10)
  if (keyLength > MUSIC_LIMITS.maxSectionBytes) throw new Error('NCM key 区段超过资源预算')
  const keyEnd = 14 + keyLength
  const metaLength = readUint32LE(bytes, keyEnd)
  if (metaLength > MUSIC_LIMITS.maxSectionBytes) throw new Error('NCM metadata 区段超过资源预算')
  const metaStart = keyEnd + 4
  const metaEnd = metaStart + metaLength
  const coverFrameOffset = metaEnd + 5
  const coverFrameLength = readUint32LE(bytes, coverFrameOffset)
  const coverLength = readUint32LE(bytes, coverFrameOffset + 4)
  if (coverFrameLength > MUSIC_LIMITS.maxSectionBytes || coverLength > MUSIC_LIMITS.maxSectionBytes) throw new Error('NCM 封面区段超过资源预算')
  const audioOffset = coverFrameOffset + 8 + coverFrameLength
  if (audioOffset >= fileSize) throw new Error('NCM 音频区段为空')
  const metadata = parseNcmMetadata(bytes.subarray(metaStart, metaEnd))
  return { audioOffset, keyBox: buildNcmKeyBox(parseNcmKey(bytes.subarray(14, keyEnd))), metadataFormat: metadata?.format }
}

function simpleMakeKey(salt: number, length: number) { const key = new Uint8Array(length); for (let index = 0; index < length; index += 1) key[index] = Math.abs(Math.tan(salt + index * 0.1)) * 100; return key }

function teaDecryptBlock(input: Uint8Array, key: Uint8Array) {
  let v0 = readUint32BE(input, 0); let v1 = readUint32BE(input, 4)
  const k0 = readUint32BE(key, 0); const k1 = readUint32BE(key, 4); const k2 = readUint32BE(key, 8); const k3 = readUint32BE(key, 12)
  const delta = 0x9e3779b9; let sum = Math.imul(delta, 16) >>> 0
  for (let round = 0; round < 16; round += 1) {
    v1 = (v1 - ((Math.imul(v0, 16) + k2) ^ ((v0 + sum) >>> 0) ^ ((v0 >>> 5) + k3))) >>> 0
    v0 = (v0 - ((Math.imul(v1, 16) + k0) ^ ((v1 + sum) >>> 0) ^ ((v1 >>> 5) + k1))) >>> 0
    sum = (sum - delta) >>> 0
  }
  const output = new Uint8Array(8); writeUint32BE(output, 0, v0); writeUint32BE(output, 4, v1); return output
}

function decryptTencentTea(input: Uint8Array, key: Uint8Array) {
  if (input.length < 16 || input.length % 8 !== 0) throw new Error('QMC TEA 区段无效')
  let block = teaDecryptBlock(input.subarray(0, 8), key); const padding = block[0] & 7; const outputLength = input.length - 1 - padding - 2 - 7
  if (outputLength < 0) throw new Error('QMC TEA 区段截断')
  let ivPrevious = new Uint8Array(8); let ivCurrent = input.subarray(0, 8).slice(); let inputOffset = 8; let blockOffset = 1 + padding
  const output = new Uint8Array(outputLength); let outputOffset = 0
  const nextBlock = () => { ivPrevious = ivCurrent; ivCurrent = input.subarray(inputOffset, inputOffset + 8).slice(); block = teaDecryptBlock(xorBytes(block, ivCurrent), key); inputOffset += 8; blockOffset = 0 }
  const nextByte = () => { if (blockOffset === 8) nextBlock(); const value = block[blockOffset] ^ ivPrevious[blockOffset]; blockOffset += 1; return value }
  nextByte(); nextByte(); while (outputOffset < output.length) output[outputOffset++] = nextByte()
  if (blockOffset === 8) nextBlock()
  if ((block[blockOffset] ^ ivPrevious[blockOffset]) !== 0) throw new Error('QMC TEA zero check failed')
  return output
}

function deriveQmcKey(rawKey: Uint8Array) {
  const decoded = decodeBase64(ascii(rawKey)); if (decoded.length < 16) throw new Error('QMC raw key 过短')
  const material = sameBytes(decoded.subarray(0, RAW_KEY_PREFIX_V2.length), RAW_KEY_PREFIX_V2) ? decodeBase64(ascii(decryptTencentTea(decryptTencentTea(decoded.subarray(RAW_KEY_PREFIX_V2.length), DERIVE_V2_KEY_1), DERIVE_V2_KEY_2))) : decoded
  if (material.length < 16) throw new Error('QMC 派生 key 过短')
  const simpleKey = simpleMakeKey(106, 8); const teaKey = new Uint8Array(16)
  for (let index = 0; index < 8; index += 1) { teaKey[index * 2] = simpleKey[index]; teaKey[index * 2 + 1] = material[index] }
  return concatBytes(material.subarray(0, 8), decryptTencentTea(material.subarray(8), teaKey))
}

function rotate(value: number, bits: number) { const amount = (bits + 4) % 8; return ((value << amount) | (value >>> amount)) & 0xff }

function buildRc4(key: Uint8Array) {
  const box = Uint8Array.from({ length: key.length }, (_, index) => index); let j = 0
  for (let index = 0; index < key.length; index += 1) { j = (j + box[index] + key[index % key.length]) % key.length; [box[index], box[j]] = [box[j], box[index]] }
  let hash = 1
  for (const value of key) { if (value === 0) continue; const next = Math.imul(hash, value) >>> 0; if (next === 0 || next <= hash) break; hash = next }
  return { box, hash }
}

function segmentSkip(key: Uint8Array, hash: number, id: number) { const seed = key[id % key.length]; return seed === 0 ? 0 : Math.trunc(hash / ((id + 1) * seed) * 100) % key.length }

function decryptRc4Segment(input: Uint8Array, key: Uint8Array, boxBase: Uint8Array, hash: number, offset: number) {
  const output = input.slice(); const box = boxBase.slice(); let j = 0; let k = 0; const skip = (offset % 5120) + segmentSkip(key, hash, Math.floor(offset / 5120))
  for (let index = -skip; index < output.length; index += 1) { j = (j + 1) % key.length; k = (box[j] + k) % key.length; [box[j], box[k]] = [box[k], box[j]]; if (index >= 0) output[index] ^= box[(box[j] + box[k]) % key.length] }
  return output
}

export function createQmcCipher(rawKey: Uint8Array): QmcCipher {
  const key = rawKey.length === 0 ? rawKey : deriveQmcKey(rawKey)
  if (key.length > 300) { const rc4 = buildRc4(key); return { kind: 'rc4', key, box: rc4.box, hash: rc4.hash } }
  return key.length > 0 ? { kind: 'map', key } : { kind: 'static', key }
}

export function decryptQmcChunk(chunk: Uint8Array, cipher: QmcCipher, offset: number) {
  if (cipher.kind === 'static') return chunk.slice()
  if (cipher.kind === 'map') {
    const output = chunk.slice()
    for (let index = 0; index < output.length; index += 1) { let position = offset + index; if (position > 0x7fff) position %= 0x7fff; const keyIndex = (position * position + 71214) % cipher.key.length; output[index] ^= rotate(cipher.key[keyIndex], keyIndex & 7) }
    return output
  }
  const output = chunk.slice(); let remaining = output.length; let processed = 0; let current = offset
  const mark = (count: number) => { current += count; remaining -= count; processed += count }
  if (current < 128) { const count = Math.min(remaining, 128 - current); for (let index = 0; index < count; index += 1) output[index] ^= cipher.key[segmentSkip(cipher.key, cipher.hash!, current + index)]; mark(count); if (remaining === 0) return output }
  if (current % 5120 !== 0) { const count = Math.min(remaining, 5120 - current % 5120); output.set(decryptRc4Segment(output.subarray(processed, processed + count), cipher.key, cipher.box!, cipher.hash!, current), processed); mark(count); if (remaining === 0) return output }
  while (remaining > 5120) { output.set(decryptRc4Segment(output.subarray(processed, processed + 5120), cipher.key, cipher.box!, cipher.hash!, current), processed); mark(5120) }
  if (remaining > 0) output.set(decryptRc4Segment(output.subarray(processed), cipher.key, cipher.box!, cipher.hash!, current), processed)
  return output
}

export function detectAudio(bytes: Uint8Array) {
  if (ascii(bytes.subarray(0, 4)) === 'fLaC') return { format: 'flac' as const, magic: 'fLaC' }
  if (ascii(bytes.subarray(0, 4)) === 'OggS') return { format: 'ogg' as const, magic: 'OggS' }
  if (ascii(bytes.subarray(0, 3)) === 'ID3') return { format: 'mp3' as const, magic: 'ID3' }
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return { format: 'mp3' as const, magic: `${bytes[0].toString(16)}${bytes[1].toString(16)}` }
  if (ascii(bytes.subarray(0, 4)) === 'RIFF') return { format: 'wav' as const, magic: 'RIFF' }
  return { format: 'unknown' as const, magic: Array.from(bytes.subarray(0, 4), (value) => value.toString(16).padStart(2, '0')).join('') }
}

export function parseQmcFooter(bytes: Uint8Array, fileSize: number): QmcFooter {
  if (bytes.length < 4) throw new Error('QMC footer 截断')
  const suffix = bytes.subarray(bytes.length - 4)
  if (ascii(suffix) === 'STag') throw new Error('QMC STag 没有可用媒体 key')
  if (suffix[0] === 0x63 && suffix[1] === 0x65 && suffix[2] === 0x78 && suffix[3] === 0) throw new Error('QMC cex footer 需要外部 MMKV，当前浏览器路径不支持')
  if (ascii(suffix) === 'QTag') {
    if (bytes.length < 8) throw new Error('QMC QTag footer 截断')
    const metadataLength = readUint32BE(bytes, bytes.length - 8)
    if (metadataLength > MUSIC_LIMITS.maxFooterBytes) throw new Error('QMC QTag footer 超过资源预算')
    const rawMeta = bytes.subarray(bytes.length - 8 - metadataLength, bytes.length - 8)
    const comma = rawMeta.indexOf(0x2c); if (comma < 0) throw new Error('QMC QTag metadata 无效')
    return { audioBytes: fileSize - 8 - metadataLength, rawKey: rawMeta.subarray(0, comma), footer: 'qtag' }
  }
  const keyLength = readUint32LE(suffix, 0)
  if (keyLength > 0 && keyLength <= MUSIC_LIMITS.maxFooterBytes) {
    const rawKey = bytes.subarray(bytes.length - 4 - keyLength, bytes.length - 4)
    let end = rawKey.length; while (end > 0 && rawKey[end - 1] === 0) end -= 1
    return { audioBytes: fileSize - 4 - keyLength, rawKey: rawKey.subarray(0, end), footer: 'raw-key' }
  }
  return { audioBytes: fileSize, rawKey: new Uint8Array(), footer: 'static' }
}

export function getKgmMagic() { return KGM_MAGIC }
export function getNcmMagic() { return NCM_MAGIC }
