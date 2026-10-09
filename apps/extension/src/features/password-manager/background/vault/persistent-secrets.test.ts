import { afterEach, describe, expect, it, vi } from 'vitest'
import { sealPersistentMaterial } from './persistent-secrets'

afterEach(() => vi.unstubAllGlobals())

describe('device key transaction durability', () => {
  it.each(['complete', 'abort'] as const)('waits for the write transaction to %s', async outcome => {
    let signalWrite!: () => void
    const writeStarted = new Promise<void>(resolve => { signalWrite = resolve })
    const transaction = {
      oncomplete: undefined as (() => void) | undefined,
      onerror: undefined as (() => void) | undefined,
      onabort: undefined as (() => void) | undefined,
      error: null,
      objectStore: () => ({ put: () => { queueMicrotask(signalWrite); return {} } }),
    }
    const database = {
      close: vi.fn(),
      transaction: (_name: string, mode: string) => mode === 'readwrite' ? transaction : {
        objectStore: () => ({ get: () => {
          const request = { result: undefined, onsuccess: undefined as (() => void) | undefined }
          queueMicrotask(() => request.onsuccess?.())
          return request
        } }),
      },
    }
    vi.stubGlobal('indexedDB', { open: () => {
      const request = { result: database, onsuccess: undefined as (() => void) | undefined }
      queueMicrotask(() => request.onsuccess?.())
      return request
    } })
    let finished = false
    const pending = sealPersistentMaterial({ username: 'test', appPassword: 'synthetic', vaultKey: 'synthetic-key' })
    void pending.then(() => { finished = true }, () => { finished = true })
    await writeStarted
    expect(finished).toBe(false)
    if (outcome === 'abort') {
      transaction.onabort?.()
      await expect(pending).rejects.toThrow('本地设备密钥保存已中止')
    } else {
      transaction.oncomplete?.()
      await expect(pending).resolves.toMatchObject({ version: 1, algorithm: 'AES-256-GCM' })
    }
    expect(database.close).toHaveBeenCalledOnce()
  })
})

it('fails closed without IndexedDB instead of writing a raw key to local storage', async () => {
  vi.stubGlobal('indexedDB', undefined)
  const set = vi.fn()
  vi.stubGlobal('chrome', { storage: { local: { get: vi.fn(), set } } })
  await expect(sealPersistentMaterial({ username: 'test', appPassword: 'synthetic', vaultKey: 'synthetic-key' })).rejects.toThrow('缺少 IndexedDB')
  expect(set).not.toHaveBeenCalled()
})
