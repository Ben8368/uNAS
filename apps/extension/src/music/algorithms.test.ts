import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { aes128Ecb, createKgmCipher, createQmcCipher, decryptKgmChunk, detectAudio, parseKgmHeader } from './algorithms'

describe('music browser algorithms', () => {
  it('decrypts the AES-128 ECB known vector used by the NCM adapter', () => {
    const ciphertext = Uint8Array.from(Buffer.from('69c4e0d86a7b0430d8cdb78070b4c55a', 'hex'))
    const key = Uint8Array.from(Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex'))
    expect(Buffer.from(aes128Ecb(ciphertext, key)).toString('hex')).toBe('00112233445566778899aabbccddeeff')
  })

  it('matches the KGM Kugou MD5 box derivation', () => {
    const header = new Uint8Array(60)
    header.set(Uint8Array.from({ length: 16 }, (_, index) => index), 44)
    const cipher = createKgmCipher(header)
    expect(Array.from(cipher.fileBox.subarray(0, 16))).toEqual([0xc2, 0xa8, 0x1a, 0x4f, 0x29, 0x33, 0xe0, 0xd3, 0xaf, 0x1b, 0xe9, 0x6c, 0xef, 0x01, 0x1a, 0xc1])
    expect(Array.from(cipher.slotBox)).toEqual([0x14, 0xe3, 0x10, 0xb1, 0x0d, 0x3b, 0x6f, 0x41, 0x85, 0x6b, 0x79, 0x27, 0x8b, 0xfd, 0x61, 0x85])
  })

  it('keeps static QMC output unchanged and detects audio signatures', () => {
    const cipher = createQmcCipher(new Uint8Array())
    expect(cipher.kind).toBe('static')
    expect(detectAudio(new TextEncoder().encode('OggS')).format).toBe('ogg')
  })

  it('decrypts the maintained local KGM sample with the browser algorithm when present', () => {
    const path = 'C:/Users/ben.luo/Downloads/陈奕迅 - K歌之王 (粤语版).kgm.flac'
    if (!existsSync(path)) return
    const input = readFileSync(path)
    const header = new Uint8Array(input.subarray(0, 60))
    const parsed = parseKgmHeader(header)
    const output = decryptKgmChunk(new Uint8Array(input.subarray(parsed.audioOffset, parsed.audioOffset + 64)), createKgmCipher(header), 0)
    expect(new TextDecoder('ascii').decode(output.subarray(0, 4))).toBe('fLaC')
  })
})
