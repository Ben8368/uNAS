import type { CacheEntry, CacheSnapshot } from '#contracts'
import { extensionApi } from 'unas-src/runtime/extensionPlatform'
import { offerFileExport, requireExtensionFiles, selectOneFile } from './fileManagerIO'

export const CACHE_LIMITS = Object.freeze({ maxFileBytes: 256 * 1024 * 1024, maxEntries: 200, ttlMs: 24 * 60 * 60 * 1000 })
const ROOT = 'unas-file-manager-cache-v1'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
type Directory = FileSystemDirectoryHandle & { entries(): AsyncIterableIterator<[string, FileSystemHandle]> }

export function validCacheRecord(value: unknown, id: string): value is CacheEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as CacheEntry
  return UUID.test(id) && entry.id === id && typeof entry.name === 'string' && entry.name.length > 0 && entry.name.length <= 255 && !/[\\/]/.test(entry.name) && ![...entry.name].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
    && Number.isSafeInteger(entry.size) && entry.size >= 0 && entry.size <= CACHE_LIMITS.maxFileBytes
    && Number.isSafeInteger(entry.createdAt) && Number.isSafeInteger(entry.expiresAt) && entry.expiresAt === entry.createdAt + CACHE_LIMITS.ttlMs
    && (entry.trashedAt === undefined || Number.isSafeInteger(entry.trashedAt))
}
export function assertCacheBudget(entries: CacheEntry[], bytes: number) {
  if (bytes > CACHE_LIMITS.maxFileBytes) throw new Error('单个缓存文件超过 256 MiB 上限。')
  if (entries.length >= CACHE_LIMITS.maxEntries) throw new Error('临时缓存已达到 200 项上限（含回收站），请清理后重试。')
}

async function root() {
  requireExtensionFiles()
  if (typeof navigator.storage?.getDirectory !== 'function' || typeof navigator.locks?.request !== 'function') throw new Error('当前浏览器未开放私有文件存储或安全锁；临时缓存不可用。')
  return await (await navigator.storage.getDirectory()).getDirectoryHandle(ROOT, { create: true }) as Directory
}
async function locked<T>(action: (directory: Directory) => Promise<T>) {
  const directory = await root()
  return await navigator.locks.request(ROOT, { ifAvailable: true }, async lock => {
    if (!lock) throw new Error('另一页面正在修改临时缓存，请稍后刷新重试。')
    return await action(directory)
  })
}
async function writeRecord(directory: FileSystemDirectoryHandle, record: CacheEntry) {
  const handle = await directory.getFileHandle('record.json', { create: true })
  const writer = await handle.createWritable()
  try { await writer.write(JSON.stringify(record)); await writer.close() }
  catch (error) { await writer.abort().catch(() => undefined); throw error }
}
async function readRecord(directory: Directory, id: string) {
  if (!UUID.test(id)) throw new Error('缓存引用无效。')
  const item = await directory.getDirectoryHandle(id)
  const metadata = await (await item.getFileHandle('record.json')).getFile()
  if (metadata.size > 4096) throw new Error('缓存记录超过大小预算。')
  const record: unknown = JSON.parse(await metadata.text())
  if (!validCacheRecord(record, id)) throw new Error('缓存记录无效。')
  const file = await (await item.getFileHandle('payload')).getFile()
  if (file.size !== record.size) throw new Error('缓存内容不完整。')
  return { item, record, file }
}
async function scan(directory: Directory) {
  const records: CacheEntry[] = []
  let enumerated = 0
  for await (const [id, handle] of directory.entries()) {
    if (++enumerated > CACHE_LIMITS.maxEntries + 1) throw new Error('缓存条目超过枚举预算，请检查扩展私有存储。')
    if (!UUID.test(id) || handle.kind !== 'directory') throw new Error('缓存目录包含未知条目，未自动删除。')
    try {
      const { record } = await readRecord(directory, id)
      if (record.expiresAt <= Date.now()) await directory.removeEntry(id, { recursive: true })
      else records.push(record)
    } catch (error) {
      // Only interrupted imports (without a committed record) are safe to discard.
      if (error instanceof DOMException && error.name === 'NotFoundError') await directory.removeEntry(id, { recursive: true })
      else throw error
    }
  }
  return records
}

export const tempCachePort = Object.freeze({
  async list(): Promise<CacheSnapshot> {
    const entries = await locked(scan)
    const estimate = await navigator.storage.estimate()
    const permission = extensionApi()?.permissions
    const unlimited = Boolean(permission && await permission.contains({ permissions: ['unlimitedStorage'] }))
    const persisted = typeof navigator.storage.persisted === 'function' && await navigator.storage.persisted()
    return { entries, usedBytes: entries.reduce((total, entry) => total + entry.size, 0), maxFileBytes: CACHE_LIMITS.maxFileBytes, quota: estimate.quota, originUsage: estimate.usage, protected: unlimited || persisted }
  },
  async requestStorage() {
    requireExtensionFiles()
    if (typeof navigator.storage?.persist !== 'function') return 'unsupported' as const
    return await navigator.storage.persist() ? 'granted' as const : 'denied' as const
  },
  async importFile() {
    const file = await selectOneFile()
    if (!file) return false
    if (!validCacheRecord({ id: '00000000-0000-0000-0000-000000000000', name: file.name, size: file.size, createdAt: 0, expiresAt: CACHE_LIMITS.ttlMs }, '00000000-0000-0000-0000-000000000000')) throw new Error('文件名无效或文件超过 256 MiB 缓存上限。')
    await locked(async directory => {
      const records = await scan(directory)
      assertCacheBudget(records, file.size)
      const now = Date.now()
      const record: CacheEntry = { id: crypto.randomUUID(), name: file.name, size: file.size, createdAt: now, expiresAt: now + CACHE_LIMITS.ttlMs }
      const item = await directory.getDirectoryHandle(record.id, { create: true })
      try {
        const writer = await (await item.getFileHandle('payload', { create: true })).createWritable()
        try { await writer.write(file); await writer.close() }
        catch (error) { await writer.abort().catch(() => undefined); throw error }
        await writeRecord(item, record)
      } catch (error) {
        try { await directory.removeEntry(record.id, { recursive: true }) }
        catch { throw new Error('缓存写入失败且暂存清理未完成；请刷新重试清理。') }
        if (error instanceof DOMException && error.name === 'QuotaExceededError') throw new Error('浏览器存储配额或磁盘空间不足；请清理缓存后重试。', { cause: error })
        throw error
      }
    })
    return true
  },
  async moveToTrash(id: string) {
    await locked(async directory => {
      const { item, record } = await readRecord(directory, id)
      if (record.expiresAt <= Date.now()) throw new Error('该缓存已过期，请刷新。')
      if (record.trashedAt !== undefined) throw new Error('该缓存已在回收站，请刷新。')
      await writeRecord(item, { ...record, trashedAt: Date.now() })
    })
  },
  async restore(id: string) {
    await locked(async directory => {
      const { item, record } = await readRecord(directory, id)
      if (record.expiresAt <= Date.now()) throw new Error('该缓存已过期，无法恢复。')
      if (record.trashedAt === undefined) throw new Error('该缓存不在回收站，请刷新。')
      const restored = { ...record }; delete restored.trashedAt
      await writeRecord(item, restored)
    })
  },
  async purge(id: string) {
    await locked(async directory => {
      const { record } = await readRecord(directory, id)
      if (record.trashedAt === undefined) throw new Error('请先将缓存移入回收站。')
      await directory.removeEntry(id, { recursive: true })
    })
  },
  async clear(trash: boolean) {
    await locked(async directory => {
      for (const record of await scan(directory)) if ((record.trashedAt !== undefined) === trash) await directory.removeEntry(record.id, { recursive: true })
    })
  },
  async exportFile(id: string) {
    await locked(async directory => {
      const { record, file } = await readRecord(directory, id)
      if (record.expiresAt <= Date.now() || record.trashedAt !== undefined) throw new Error('缓存已过期或已移入回收站，请刷新。')
      offerFileExport(file, record.name)
    })
  },
})
