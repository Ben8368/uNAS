import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  aes128Ecb,
  buildNcmKeyBox,
  createKgmCipher,
  createQmcCipher,
  decryptKgmChunk,
  decryptNcmChunk,
  decryptQmcChunk,
  detectAudio,
  parseKgmHeader,
  parseNcmHeader,
  parseQmcFooter,
} from './algorithms'
import { MUSIC_LIMITS } from './types'

describe('music browser algorithms', () => {
  it('decrypts the AES-128 ECB known vector used by the NCM adapter', () => {
    const ciphertext = Uint8Array.from(Buffer.from('69c4e0d86a7b0430d8cdb78070b4c55a', 'hex'))
    const key = Uint8Array.from(Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex'))
    expect(Buffer.from(aes128Ecb(ciphertext, key)).toString('hex')).toBe('00112233445566778899aabbccddeeff')
  })

  it('keeps NCM audio decryption consistent across chunk boundaries', () => {
    const ciphertext = Uint8Array.from({ length: 32 }, (_, index) => index * 7 & 0xff)
    const box = buildNcmKeyBox(new TextEncoder().encode('Key'))
    const complete = decryptNcmChunk(ciphertext, box, 0)
    const firstChunk = decryptNcmChunk(ciphertext.subarray(0, 13), box, 0)
    const secondChunk = decryptNcmChunk(ciphertext.subarray(13), box, 13)
    expect(Uint8Array.from(Buffer.concat([Buffer.from(firstChunk), Buffer.from(secondChunk)]))).toEqual(complete)
    expect(complete).not.toEqual(ciphertext)
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

  const fixtures = [
    {
      name: 'KGM', env: 'UNAS_MUSIC_KGM_FIXTURE', outputFormat: 'flac',
      decrypt(input: Uint8Array) {
        const header = input.subarray(0, 60)
        const parsed = parseKgmHeader(header)
        const cipher = createKgmCipher(header)
        return {
          audioOffset: parsed.audioOffset,
          audioBytes: input.length - parsed.audioOffset,
          decode: (chunk: Uint8Array, offset: number) => decryptKgmChunk(chunk, cipher, offset),
        }
      },
    },
    {
      name: 'NCM', env: 'UNAS_MUSIC_NCM_FIXTURE', outputFormat: undefined,
      decrypt(input: Uint8Array) {
        const parsed = parseNcmHeader(input, input.length)
        return {
          audioOffset: parsed.audioOffset,
          audioBytes: input.length - parsed.audioOffset,
          decode: (chunk: Uint8Array, offset: number) => decryptNcmChunk(chunk, parsed.keyBox, offset),
        }
      },
    },
    {
      name: 'QMC', env: 'UNAS_MUSIC_QMC_FIXTURE', outputFormat: undefined,
      decrypt(input: Uint8Array) {
        const tailLength = Math.min(input.length, MUSIC_LIMITS.maxFooterBytes + 8)
        const footer = parseQmcFooter(input.subarray(input.length - tailLength), input.length)
        const cipher = createQmcCipher(footer.rawKey)
        return {
          audioOffset: 0,
          audioBytes: footer.audioBytes,
          decode: (chunk: Uint8Array, offset: number) => decryptQmcChunk(chunk, cipher, offset),
        }
      },
    },
  ] as const

  for (const fixture of fixtures) {
    const path = process.env[fixture.env]?.trim()
    it.skipIf(!path || !existsSync(path))(`decrypts the complete configured private ${fixture.name} sample`, () => {
      const input = readFileSync(path!)
      expect(input.byteLength).toBeGreaterThan(0)
      expect(input.byteLength).toBeLessThanOrEqual(MUSIC_LIMITS.maxInputBytes)

      const parsed = fixture.decrypt(input)
      expect(parsed.audioOffset).toBeGreaterThanOrEqual(0)
      expect(parsed.audioBytes).toBeGreaterThan(0)
      expect(parsed.audioBytes).toBeLessThanOrEqual(MUSIC_LIMITS.maxOutputBytes)
      expect(parsed.audioOffset + parsed.audioBytes).toBeLessThanOrEqual(input.length)

      let audioOffset = parsed.audioOffset
      let outputOffset = 0
      let prefix = new Uint8Array()
      while (outputOffset < parsed.audioBytes) {
        const length = Math.min(MUSIC_LIMITS.workerChunkBytes, parsed.audioBytes - outputOffset)
        const decoded = parsed.decode(input.subarray(audioOffset, audioOffset + length), outputOffset)
        expect(decoded).toHaveLength(length)
        if (prefix.length < 16) {
          const merged = new Uint8Array(Math.min(16, prefix.length + decoded.length))
          merged.set(prefix)
          merged.set(decoded.subarray(0, merged.length - prefix.length), prefix.length)
          prefix = merged
        }
        audioOffset += length
        outputOffset += decoded.length
      }

      const detected = detectAudio(prefix)
      expect(detected.format).not.toBe('unknown')
      if (fixture.outputFormat) expect(detected.format).toBe(fixture.outputFormat)
    })
  }
})
