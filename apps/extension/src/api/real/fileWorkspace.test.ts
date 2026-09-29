import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const prepare = vi.hoisted(() => vi.fn())
vi.mock('./zipExtraction', () => ({ prepareZipExtraction: prepare }))
const missing = () => Promise.reject(new DOMException('missing', 'NotFoundError'))
let lockAvailable = true
let releaseCommit: () => void
let commitStarted: Promise<void>
let root: any
let api: typeof import('./fileWorkspace')
beforeEach(async () => {
  vi.resetModules()
  lockAvailable = true
  let signalCommit!: () => void
  commitStarted = new Promise(resolve => { signalCommit = resolve })
  const heldCommit = new Promise<void>(resolve => { releaseCommit = resolve })
  const output = {
    getFileHandle: vi.fn(async (_name, options) => {
      if (!options?.create) return missing()
      return { createWritable: async () => ({ write: async () => { signalCommit(); await heldCommit }, close: async () => {} }) }
    }), getDirectoryHandle: missing,
  }
  root = {
    name: 'test', queryPermission: async () => 'granted', requestPermission: async () => 'granted',
    getFileHandle: vi.fn(async (name) => name === 'input.zip' ? { getFile: async () => new File([new Uint8Array([80,75,3,4])], name) } : missing()),
    getDirectoryHandle: vi.fn(async (_name, options) => options?.create ? output : missing()),
  }
  vi.stubGlobal('indexedDB', { open: () => {
    const request: any = { result: { close() {}, transaction: () => ({ objectStore: () => ({ get: () => {
      const read: any = { result: { id: 'test', schemaVersion: 1, createdAt: 0, handle: root } }
      queueMicrotask(() => read.onsuccess()); return read
    } }) }) } }
    queueMicrotask(() => request.onsuccess()); return request
  } })
  vi.stubGlobal('navigator', { locks: { request: vi.fn(async (_name, _options, callback) => callback(lockAvailable ? {} : null)) } })
  prepare.mockReturnValue({ result: Promise.resolve([{ type: 'file', path: 'test.txt', data: new Blob(['test']) }]), cancel: vi.fn() })
  api = await import('./fileWorkspace')
  await api.restoreFileManagerDirectory()
  await api.requestFileManagerDirectoryWriteAccess()
})
afterEach(() => { releaseCommit(); vi.unstubAllGlobals() })
describe('ZIP operation ownership', () => {
  it('rejects a second call before the first asynchronous permission check finishes', async () => {
    const first = api.extractAuthorizedZip('/', 'input.zip')
    await expect(api.extractAuthorizedZip('/', 'input.zip')).rejects.toThrow('已有 ZIP')
    await commitStarted
    releaseCommit()
    await first
    expect(prepare).toHaveBeenCalledOnce()
  })
  it('holds ownership throughout commit and does not cancel committed user files', async () => {
    const first = api.extractAuthorizedZip('/', 'input.zip')
    await commitStarted
    api.cancelAuthorizedZipExtraction()
    expect(prepare.mock.results[0].value.cancel).not.toHaveBeenCalled()
    await expect(api.extractAuthorizedZip('/', 'input.zip')).rejects.toThrow('已有 ZIP')
    releaseCommit()
    await expect(first).resolves.toMatchObject({ filesWritten: 1 })
  })
  it('rejects another page holding the origin lock before reading input', async () => {
    lockAvailable = false
    await expect(api.extractAuthorizedZip('/', 'input.zip')).rejects.toThrow('其他页面')
    expect(root.getFileHandle).not.toHaveBeenCalled()
    lockAvailable = true
    const next = api.extractAuthorizedZip('/', 'input.zip')
    await commitStarted; releaseCommit(); await next
  })
  it('honors cancellation during input reads without starting a Worker', async () => {
    let release!: () => void
    const reading = new Promise<void>(resolve => { release = resolve })
    root.getFileHandle.mockImplementation(async () => { await reading; return { getFile: async () => new File([new Uint8Array([80,75,3,4])], 'input.zip') } })
    const pending = api.extractAuthorizedZip('/', 'input.zip')
    api.cancelAuthorizedZipExtraction()
    release()
    await expect(pending).rejects.toThrow('已取消')
    expect(prepare).not.toHaveBeenCalled()
  })
})
