import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const prepare = vi.hoisted(() => vi.fn())
vi.mock('../../archive/real/zipExtraction', () => ({ prepareZipExtraction: prepare }))
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
  const inputBytes = new Uint8Array([80, 75, 3, 4, 101, 102, 103, 104])
  const inputFile = () => new File([inputBytes], 'input.zip', { lastModified: 123 })
  const output = {
    getFileHandle: vi.fn(async (_name, options) => {
      if (!options?.create) return missing()
      return { createWritable: async () => ({ write: async () => { signalCommit(); await heldCommit }, close: async () => {} }) }
    }), getDirectoryHandle: missing,
  }
  root = {
    name: 'test', queryPermission: async () => 'granted', requestPermission: async () => 'granted',
    entries: async function* () { yield ['input.zip', { kind: 'file', getFile: inputFile }] },
    getFileHandle: vi.fn(async (name) => name === 'input.zip' ? { getFile: inputFile } : missing()),
    getDirectoryHandle: vi.fn(async (_name, options) => options?.create ? output : missing()),
  }
  vi.stubGlobal('indexedDB', { open: () => {
    const request: any = { result: { close() {}, transaction: () => {
      const transaction: any = { objectStore: () => ({ get: () => {
        const read: any = { result: { id: 'test', schemaVersion: 1, createdAt: 0, handle: root } }
        queueMicrotask(() => read.onsuccess()); return read
      }, delete: () => { queueMicrotask(() => transaction.oncomplete?.()) } }) }
      return transaction
    } } }
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

describe('owner-scoped file references', () => {
  it('keeps child routes, file references and explicit write mode when a pane restores the same grant', async () => {
    const child = { kind: 'directory', name: 'nested', entries: async function* () {} }
    root.entries = async function* () {
      yield ['nested', child]
      yield ['input.zip', { kind: 'file', getFile: async () => new File(['same'], 'input.zip', { lastModified: 123 }) }]
    }
    await api.listAuthorizedDirectory('/')
    await api.listAuthorizedDirectory('/nested')
    const ref = await api.createAuthorizedFileRef('/input.zip')
    const snapshot = api.getFileWorkspaceSnapshot()
    expect(await api.restoreFileManagerDirectory()).toBe(snapshot)
    expect(api.getFileWorkspaceSnapshot().writeAccess).toBe('granted')
    await expect(api.listAuthorizedDirectory('/nested')).resolves.toMatchObject({ path: '/nested' })
    const lease = await api.openAuthorizedFileRef(ref)
    expect(await new Response(lease.stream).text()).toBe('same')
  })
  it('reads only an explicit bounded range and invalidates references on forget', async () => {
    await api.listAuthorizedDirectory('/')
    const ref = await api.createAuthorizedFileRef('/input.zip')
    expect(ref).toMatchObject({ schemaVersion: 1, source: 'handle', authorization: 'available', name: 'input.zip' })
    const lease = await api.openAuthorizedFileRef(ref, { offset: 2, length: 3 })
    expect([...new Uint8Array(await new Response(lease.stream).arrayBuffer())]).toEqual([3, 4, 101])
    await api.forgetFileManagerDirectory()
    await expect(api.openAuthorizedFileRef(ref, { offset: 0, length: 1 })).rejects.toThrow('尚未授权')
  })

  it('rejects oversized and out-of-range reads without opening a stream', async () => {
    await api.listAuthorizedDirectory('/')
    const ref = await api.createAuthorizedFileRef('/input.zip')
    await expect(api.openAuthorizedFileRef(ref, { offset: 0, length: 8 * 1024 * 1024 + 1 })).rejects.toThrow('8 MiB')
    await expect(api.openAuthorizedFileRef(ref, { offset: 9, length: 1 })).rejects.toThrow('8 MiB')
  })
})

describe('exact existing entry names', () => {
  it('deletes only the confirmed name, including leading/trailing spaces and long existing names', async () => {
    const names = new Set([' report.txt ', 'report.txt', 'x'.repeat(150)])
    root.removeEntry = vi.fn(async name => { names.delete(name) })
    await api.deleteAuthorizedDirectoryEntry('/', ' report.txt ')
    expect(names.has('report.txt')).toBe(true)
    expect(names.has(' report.txt ')).toBe(false)
    expect(root.removeEntry).toHaveBeenCalledWith(' report.txt ', { recursive: false })
    await api.deleteAuthorizedDirectoryEntry('/', 'x'.repeat(150))
    expect(names.has('x'.repeat(150))).toBe(false)
  })

  it('rejects control characters without performing a deletion', async () => {
    root.removeEntry = vi.fn()
    await expect(api.deleteAuthorizedDirectoryEntry('/', 'bad\nname.txt')).rejects.toThrow('控制字符')
    expect(root.removeEntry).not.toHaveBeenCalled()
  })
})
