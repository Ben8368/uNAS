import { describe, expect, it } from 'vitest'
import type { QmcFooter } from './algorithms'
import { parseQmcKeyFile, resolveQmcKey, selectQmcKey } from './qmcKeys'
import { MUSIC_LIMITS } from './types'

const ENCODER = new TextEncoder()

describe('QMC ekey manifest parsing', () => {
  it('parses JSON entries and normalizes names to NFC', () => {
    const keys = parseQmcKeyFile(JSON.stringify({
      'e\u0301.mflac': 'key-a',
      'C:\\Music\\song.mgg': 'key-b',
    }))
    expect(keys.get('é.mflac')).toBe('key-a')
    expect(keys.get('C:\\Music\\song.mgg')).toBe('key-b')
  })

  it('parses alternating file name / ekey lines with CRLF and blank lines', () => {
    const keys = parseQmcKeyFile('a.mflac\r\nKEYA\r\n\r\nb.mgg\nKEYB\n')
    expect(keys.get('a.mflac')).toBe('KEYA')
    expect(keys.get('b.mgg')).toBe('KEYB')
    expect(keys.size).toBe(2)
  })

  it('rejects an odd number of non-empty lines', () => {
    expect(() => parseQmcKeyFile('a.mflac\nKEYA\norphan.mgg')).toThrow('奇数')
  })

  it('rejects conflicting duplicate names but accepts identical duplicates', () => {
    expect(() => parseQmcKeyFile('a.mflac\nKEYA\na.mflac\nKEYB')).toThrow('冲突')
    expect(() => parseQmcKeyFile('a.mflac\nKEYA\na.mflac\nKEYA')).not.toThrow()
  })

  it('rejects empty, non-object, and non-string JSON values', () => {
    expect(() => parseQmcKeyFile('')).toThrow('为空')
    expect(() => parseQmcKeyFile('{ "a.mflac": [] }')).toThrow('不是字符串')
    expect(() => parseQmcKeyFile('{ "a.mflac": "" }')).toThrow('缺少 ekey')
    expect(() => parseQmcKeyFile('{ "a.mflac" }')).toThrow('不是有效 JSON')
  })

  it('rejects control characters and oversized entries', () => {
    expect(() => parseQmcKeyFile(JSON.stringify({ 'a.mflac': 'key\nvalue' }))).toThrow('控制字符')
    expect(() => parseQmcKeyFile(JSON.stringify({ 'a.mflac': 'x'.repeat(MUSIC_LIMITS.maxKeyValueChars + 1) }))).toThrow('过长')
    expect(() => parseQmcKeyFile(JSON.stringify({ ['x'.repeat(MUSIC_LIMITS.maxKeyNameChars + 1)]: 'key' }))).toThrow('过长')
  })

  it('enforces the entry budget', () => {
    const lines: string[] = []
    for (let index = 0; index <= MUSIC_LIMITS.maxKeyEntries; index += 1) lines.push(`f${index}.mflac`, `key${index}`)
    expect(() => parseQmcKeyFile(lines.join('\n'))).toThrow('项预算')
  })
})

describe('QMC key resolution', () => {
  const keys = parseQmcKeyFile(JSON.stringify({
    'song.mflac': 'exact',
    'C:\\Music\\other.mgg': 'unique',
    '/music/shared.mgg': 'shared-a',
    '/other/shared.mgg': 'shared-b',
  }))

  it('prefers an exact normalized name and falls back to a unique basename', () => {
    expect(resolveQmcKey(keys, 'song.mflac')).toBe('exact')
    expect(resolveQmcKey(keys, 'other.mgg')).toBe('unique')
  })

  it('rejects an ambiguous basename match', () => {
    expect(() => resolveQmcKey(keys, 'shared.mgg')).toThrow('同名文件')
  })
})

describe('QMC key selection', () => {
  const imported = new Map([['song.mflac', 'imported-key']])
  const embedded = { audioBytes: 10, rawKey: ENCODER.encode('embedded-key'), footer: 'raw-key' as const }

  it('keeps embedded raw-key and QTag keys authoritative', () => {
    expect(selectQmcKey(embedded, 'song.mflac', imported)).toEqual({ rawKey: embedded.rawKey, keySource: 'embedded' })
  })

  it('uses an imported key for musicex by MediaFileName, then selected file name', () => {
    const byMedia: QmcFooter = { audioBytes: 10, rawKey: new Uint8Array(), footer: 'musicex', mediaFileName: 'song.mflac' }
    expect(selectQmcKey(byMedia, 'renamed.mflac', imported)).toEqual({ rawKey: ENCODER.encode('imported-key'), keySource: 'imported' })
    const bySelected: QmcFooter = { audioBytes: 10, rawKey: new Uint8Array(), footer: 'musicex', mediaFileName: 'missing.mflac' }
    expect(selectQmcKey(bySelected, 'song.mflac', imported)).toEqual({ rawKey: ENCODER.encode('imported-key'), keySource: 'imported' })
  })

  it('requires an imported key for musicex', () => {
    const footer: QmcFooter = { audioBytes: 10, rawKey: new Uint8Array(), footer: 'musicex', mediaFileName: 'missing.mflac' }
    expect(() => selectQmcKey(footer, 'unknown.mflac', imported)).toThrow('需要匹配的 ekey')
  })

  it('uses an imported key for keyless legacy QMC and otherwise stays static', () => {
    const footer: QmcFooter = { audioBytes: 10, rawKey: new Uint8Array(), footer: 'static' }
    expect(selectQmcKey(footer, 'song.mflac', imported)).toEqual({ rawKey: ENCODER.encode('imported-key'), keySource: 'imported' })
    expect(selectQmcKey(footer, 'unknown.mflac', imported)).toEqual({ rawKey: footer.rawKey, keySource: 'static' })
  })
})
