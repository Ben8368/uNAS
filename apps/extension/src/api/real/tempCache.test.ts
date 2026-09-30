import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const io = vi.hoisted(() => ({ select: vi.fn(), export: vi.fn() }))
vi.mock('./fileManagerIO', () => ({ requireExtensionFiles() {}, selectOneFile: io.select, offerFileExport: io.export }))
vi.mock('unas-src/runtime/extensionPlatform', () => ({ extensionApi: () => ({ permissions: { contains: async () => false } }) }))
import { assertCacheBudget, CACHE_LIMITS, tempCachePort, validCacheRecord } from './tempCache'

class MemoryDirectory {
  kind = 'directory'
  children = new Map<string, MemoryDirectory | Blob>()
  async *entries() { for (const [name, handle] of this.children) yield [name, { kind: handle instanceof Blob ? 'file' : 'directory' }] }
  async getDirectoryHandle(name: string, options?: { create: boolean }): Promise<MemoryDirectory> {
    if (!this.children.has(name) && options?.create) this.children.set(name, new MemoryDirectory())
    const item = this.children.get(name)
    if (!(item instanceof MemoryDirectory)) throw new DOMException('missing', 'NotFoundError')
    return item
  }
  async getFileHandle(name: string, options?: { create: boolean }) {
    if (!this.children.has(name) && options?.create) this.children.set(name, new Blob())
    if (!(this.children.get(name) instanceof Blob)) throw new DOMException('missing', 'NotFoundError')
    return { getFile: async () => this.children.get(name) as Blob, createWritable: async () => {
      let pending: Blob
      return { write: async (data: Blob | string) => { if (failWrite && name === 'record.json') throw new DOMException('full', 'QuotaExceededError'); pending = data instanceof Blob ? data : new Blob([data]) }, close: async () => { this.children.set(name, pending) }, abort: async () => {} }
    } }
  }
  async removeEntry(name: string) { this.children.delete(name) }
}
let root: MemoryDirectory
let failWrite: boolean
let available: boolean
beforeEach(() => {
  vi.resetAllMocks(); root = new MemoryDirectory(); failWrite = false; available = true
  vi.stubGlobal('navigator', { storage: { getDirectory: async () => root, estimate: async () => ({ quota: 1024 ** 3, usage: 10 }), persisted: async () => false, persist: async () => false }, locks: { request: async (_name: string, _options: unknown, action: (lock: object | null) => Promise<unknown>) => await action(available ? {} : null) } })
})
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })
describe('temporary cache lifecycle', () => {
  it('imports, trashes, restores and exports the original bytes without changing expiry', async () => {
    io.select.mockResolvedValue(new File(['cache-proof'], 'proof.txt'))
    await tempCachePort.importFile()
    const original = (await tempCachePort.list()).entries[0]
    await tempCachePort.moveToTrash(original.id)
    expect((await tempCachePort.list()).entries[0].trashedAt).toEqual(expect.any(Number))
    await expect(tempCachePort.exportFile(original.id)).rejects.toThrow('回收站')
    await tempCachePort.restore(original.id)
    expect((await tempCachePort.list()).entries[0]).toEqual(original)
    await tempCachePort.exportFile(original.id)
    expect(await io.export.mock.calls[0][0].text()).toBe('cache-proof')
    await expect(tempCachePort.purge(original.id)).rejects.toThrow('先将缓存')
    await tempCachePort.moveToTrash(original.id); await tempCachePort.purge(original.id)
    expect((await tempCachePort.list()).entries).toEqual([])
  })
  it('allows totals above 256 MiB while enforcing the per-file and item limits, including trash', () => {
    const record = { id: crypto.randomUUID(), name: 'test', size: CACHE_LIMITS.maxFileBytes, createdAt: 0, expiresAt: CACHE_LIMITS.ttlMs, trashedAt: 1 }
    expect(validCacheRecord(record, record.id)).toBe(true)
    expect(validCacheRecord({ ...record, id: '../outside' }, '../outside')).toBe(false)
    expect(validCacheRecord({ ...record, size: CACHE_LIMITS.maxFileBytes + 1 }, record.id)).toBe(false)
    expect(() => assertCacheBudget([record], CACHE_LIMITS.maxFileBytes)).not.toThrow()
    expect(() => assertCacheBudget([], CACHE_LIMITS.maxFileBytes + 1)).toThrow('256 MiB')
    expect(() => assertCacheBudget(Array(200).fill({ ...record, size: 0 }), 0)).toThrow('200 项')
  })
  it('cleans expired items and interrupted imports only inside its own directory', async () => {
    vi.useFakeTimers(); vi.setSystemTime(100_000)
    io.select.mockResolvedValue(new File(['expired'], 'old.txt')); await tempCachePort.importFile()
    await root.getDirectoryHandle('other-app', { create: true })
    const cache = await root.getDirectoryHandle('unas-file-manager-cache-v1')
    await cache.getDirectoryHandle(crypto.randomUUID(), { create: true })
    vi.setSystemTime(100_000 + CACHE_LIMITS.ttlMs)
    expect((await tempCachePort.list()).entries).toEqual([])
    expect(cache.children.size).toBe(0)
    expect(root.children.has('other-app')).toBe(true)
  })
  it('rolls back a quota failure and allows a later import', async () => {
    io.select.mockResolvedValue(new File(['test'], 'quota.txt')); failWrite = true
    await expect(tempCachePort.importFile()).rejects.toThrow('磁盘空间不足')
    expect((await tempCachePort.list()).entries).toEqual([])
    failWrite = false; await tempCachePort.importFile()
    expect((await tempCachePort.list()).entries).toHaveLength(1)
  })
  it('refuses concurrent mutations and reports refused persistence without blocking the cache', async () => {
    available = false
    await expect(tempCachePort.list()).rejects.toThrow('另一页面')
    await expect(tempCachePort.requestStorage()).resolves.toBe('denied')
    available = true
    expect((await tempCachePort.list()).protected).toBe(false)
  })
  it('reports storage protection only after the browser actually approves it', async () => {
    Object.assign(navigator.storage, { persist: async () => true, persisted: async () => true })
    await expect(tempCachePort.requestStorage()).resolves.toBe('granted')
    expect((await tempCachePort.list()).protected).toBe(true)
  })
  it('clears only the requested cache or trash section', async () => {
    io.select.mockResolvedValue(new File(['one'], 'one.txt')); await tempCachePort.importFile()
    const first = (await tempCachePort.list()).entries[0]
    await tempCachePort.moveToTrash(first.id)
    io.select.mockResolvedValue(new File(['two'], 'two.txt')); await tempCachePort.importFile()
    await tempCachePort.clear(false)
    expect((await tempCachePort.list()).entries.map(entry => entry.id)).toEqual([first.id])
    await tempCachePort.clear(true)
    expect((await tempCachePort.list()).entries).toEqual([])
  })
})
