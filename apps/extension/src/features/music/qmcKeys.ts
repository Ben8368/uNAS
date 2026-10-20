import type { QmcFooter } from './algorithms'
import { MUSIC_LIMITS, type MusicKeySource } from './types'

export type QmcKeyMap = ReadonlyMap<string, string>

const KEY_ENCODER = new TextEncoder()

function normalize(value: string) {
  return value.normalize('NFC')
}

function hasControlCharacter(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code < 0x20 || code === 0x7f) return true
  }
  return false
}

function validateEntry(name: string, key: string, index: number) {
  if (!name) throw new Error(`ekey 清单第 ${index} 项缺少文件名。`)
  if (!key) throw new Error(`ekey 清单第 ${index} 项缺少 ekey。`)
  if (name.length > MUSIC_LIMITS.maxKeyNameChars) throw new Error(`ekey 清单第 ${index} 项文件名过长。`)
  if (key.length > MUSIC_LIMITS.maxKeyValueChars) throw new Error(`ekey 清单第 ${index} 项 ekey 过长。`)
  if (hasControlCharacter(name) || hasControlCharacter(key)) throw new Error(`ekey 清单第 ${index} 项包含控制字符。`)
}

function addEntry(result: Map<string, string>, name: string, key: string, index: number) {
  const normalizedName = normalize(name)
  const normalizedKey = normalize(key)
  const existing = result.get(normalizedName)
  if (existing !== undefined && existing !== normalizedKey) throw new Error(`ekey 清单第 ${index} 项与已有文件名冲突。`)
  result.set(normalizedName, normalizedKey)
}

function enforceEntryBudget(result: Map<string, string>) {
  if (result.size > MUSIC_LIMITS.maxKeyEntries) throw new Error(`ekey 清单超过 ${MUSIC_LIMITS.maxKeyEntries} 项预算。`)
}

/**
 * Parse a user-selected ekey manifest. Two local formats are accepted:
 * - JSON object: { "song.mflac": "<ekey>", ... }
 * - Alternating lines: file name, ekey, file name, ekey, ...
 *
 * Keys and names are normalized to NFC, matching the names used by the
 * upstream QQ Music key sources. Values are never logged or returned to the UI.
 */
export function parseQmcKeyFile(text: string): QmcKeyMap {
  if (text.length > MUSIC_LIMITS.maxKeyFileBytes) throw new Error('ekey 清单超过 1 MiB 资源预算。')
  const trimmed = text.trim()
  if (!trimmed) throw new Error('ekey 清单为空。')

  const result = new Map<string, string>()
  if (trimmed.startsWith('{')) {
    let parsed: unknown
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      throw new Error('ekey 清单不是有效 JSON。')
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('ekey 清单 JSON 必须是文件名到 ekey 的对象。')
    let index = 0
    for (const [rawName, rawKey] of Object.entries(parsed)) {
      index += 1
      if (typeof rawKey !== 'string') throw new Error(`ekey 清单第 ${index} 项的值不是字符串。`)
      const name = rawName.trim()
      const key = rawKey.trim()
      validateEntry(name, key, index)
      addEntry(result, name, key, index)
      enforceEntryBudget(result)
    }
  } else {
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
    if (lines.length % 2 !== 0) throw new Error('ekey 清单行数为奇数；需要“文件名 / ekey”成对出现。')
    if (lines.length / 2 > MUSIC_LIMITS.maxKeyEntries) throw new Error(`ekey 清单超过 ${MUSIC_LIMITS.maxKeyEntries} 项预算。`)
    for (let index = 0; index < lines.length; index += 2) {
      const name = lines[index]
      const key = lines[index + 1]
      validateEntry(name, key, index / 2 + 1)
      addEntry(result, name, key, index / 2 + 1)
    }
  }

  if (result.size === 0) throw new Error('ekey 清单没有可用的文件名/ekey 对。')
  return result
}

function baseName(value: string) {
  const parts = value.split(/[\\/]/)
  return parts[parts.length - 1] ?? ''
}

/** Resolve an exact NFC file name first, then a unique basename match for exported paths. */
export function resolveQmcKey(keys: QmcKeyMap, name: string): string | undefined {
  const normalized = normalize(name)
  const exact = keys.get(normalized)
  if (exact !== undefined) return exact
  const wantedBase = normalize(baseName(normalized))
  if (!wantedBase) return undefined

  let found: string | undefined
  for (const [candidate, key] of keys) {
    if (normalize(baseName(candidate)) !== wantedBase) continue
    if (found !== undefined && found !== key) throw new Error('ekey 清单包含多个同名文件但 ekey 不同，无法安全选择。')
    found = key
  }
  return found
}

/**
 * Embedded footer keys are authoritative. Imported keys are only used for
 * musicex tags (looked up by MediaFileName, then the selected file name) and
 * keyless legacy QMC files (looked up by the selected file name).
 */
export function selectQmcKey(footer: QmcFooter, fileName: string, keys: QmcKeyMap): { rawKey: Uint8Array; keySource: MusicKeySource } {
  if (footer.footer === 'raw-key' || footer.footer === 'qtag') return { rawKey: footer.rawKey, keySource: 'embedded' }

  const imported = footer.footer === 'musicex'
    ? resolveQmcKey(keys, footer.mediaFileName) ?? resolveQmcKey(keys, fileName)
    : resolveQmcKey(keys, fileName)
  if (footer.footer === 'musicex' && !imported) throw new Error('QMC musicex 文件需要匹配的 ekey；请导入包含该文件名的 ekey 清单。')
  if (!imported) return { rawKey: footer.rawKey, keySource: 'static' }
  return { rawKey: KEY_ENCODER.encode(imported), keySource: 'imported' }
}
