import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ request: vi.fn(), parse: vi.fn(), permission: vi.fn(), contains: vi.fn(), select: vi.fn(), export: vi.fn() }))
vi.mock('./fileManagerIO', () => ({ requireExtensionFiles() {}, selectOneFile: mock.select, offerFileExport: mock.export }))
vi.mock('unas-src/runtime/extensionPlatform', () => ({ extensionApi: () => ({ permissions: { request: mock.permission, contains: mock.contains } }) }))
vi.mock('unas-src/runtime/webdav/client', () => ({ WebDavClient: class { constructor(readonly endpoint: string) {} request = mock.request } }))
vi.mock('unas-src/runtime/webdav/listing', async original => ({ ...await original<typeof import('../../runtime/webdav/listing')>(), parseDavListing: mock.parse }))
import { createDavFilesPort } from './davFiles'

const input = { endpoint: 'https://dav.example/files/', username: 'user', appPassword: 'secret', consent: true }
const listing = { path: '', entries: [{ path: 'proof.txt', name: 'proof.txt', type: 'file', size: 5, etag: '"version-1"' }, { path: 'folder/', name: 'folder', type: 'directory', size: 0 }], truncated: false }
beforeEach(() => {
  vi.resetAllMocks()
  mock.permission.mockResolvedValue(true); mock.contains.mockResolvedValue(true)
  mock.request.mockResolvedValue({ status: 207, data: new TextEncoder().encode('<xml/>') })
  mock.parse.mockReturnValue(listing)
  vi.stubGlobal('navigator', { locks: { request: async (_name: string, _options: unknown, action: (lock: object) => Promise<unknown>) => await action({}) } })
})
afterEach(() => vi.unstubAllGlobals())

describe('WebDAV file service', () => {
  it('requires independent consent and permission before sending any request', async () => {
    const port = createDavFilesPort()
    await expect(port.connect({ ...input, consent: false })).rejects.toThrow('确认')
    expect(mock.permission).not.toHaveBeenCalled()
    mock.permission.mockResolvedValue(false)
    await expect(port.connect(input)).rejects.toThrow('未授予')
    expect(mock.request).not.toHaveBeenCalled()
    expect(mock.permission).toHaveBeenCalledWith({ origins: ['https://dav.example/*'] })
  })
  it('owns the connection attempt while the permission dialog is pending', async () => {
    let release!: (granted: boolean) => void
    mock.permission.mockReturnValue(new Promise<boolean>(resolve => { release = resolve }))
    const port = createDavFilesPort()
    const connection = port.connect(input)
    await expect(port.connect(input)).rejects.toThrow('正在执行')
    port.disconnect(); release(true)
    await expect(connection).rejects.toThrow('取消')
    expect(mock.request).not.toHaveBeenCalled()
  })
  it('never overwrites a named upload and rejects unexpected success statuses', async () => {
    const port = createDavFilesPort(); await port.connect(input)
    mock.select.mockResolvedValue(new File(['hello'], 'proof.txt'))
    mock.request.mockResolvedValue({ status: 201 })
    await port.upload('')
    expect(mock.request).toHaveBeenLastCalledWith('PUT', 'proof.txt', expect.objectContaining({ headers: { 'If-None-Match': '*', 'Content-Type': 'application/octet-stream' } }))
    mock.request.mockResolvedValue({ status: 204 })
    await expect(port.upload('')).rejects.toThrow('HTTP 204')
  })
  it('uses conditional deletion and refuses directories or weak ETags', async () => {
    const port = createDavFilesPort(); await port.connect(input)
    mock.request.mockResolvedValue({ status: 204 })
    await port.deleteFile('proof.txt')
    expect(mock.request).toHaveBeenLastCalledWith('DELETE', 'proof.txt', expect.objectContaining({ headers: { 'If-Match': '"version-1"' } }))
    await expect(port.deleteFile('folder/')).rejects.toThrow('目录不允许')
    mock.parse.mockReturnValue({ ...listing, entries: [{ ...listing.entries[0], etag: 'W/"weak"' }] })
    mock.request.mockResolvedValue({ status: 207, data: new Uint8Array() }); await port.list('')
    await expect(port.deleteFile('proof.txt')).rejects.toThrow('强 ETag')
  })
  it('stops after permission revocation and rejects unlisted resources', async () => {
    const port = createDavFilesPort(); await port.connect(input)
    mock.contains.mockResolvedValue(false); mock.request.mockClear()
    await expect(port.list('')).rejects.toThrow('已撤销')
    await expect(port.list('outside/')).rejects.toThrow('已读取')
    await expect(port.download('secret.txt')).rejects.toThrow('当前列表')
    expect(mock.request).not.toHaveBeenCalled()
  })
  it('reports uncertain remote writes without retrying after a network error', async () => {
    const port = createDavFilesPort(); await port.connect(input)
    mock.request.mockClear().mockRejectedValue(new Error('网络请求失败'))
    await expect(port.createDirectory('', 'new')).rejects.toThrow('结果尚未确认')
    expect(mock.request).toHaveBeenCalledOnce()
  })
  it('rejects a cross-page lock before writing', async () => {
    const port = createDavFilesPort(); await port.connect(input)
    vi.stubGlobal('navigator', { locks: { request: async (_name: string, _options: unknown, action: (lock: null) => Promise<unknown>) => await action(null) } })
    mock.request.mockClear()
    await expect(port.deleteFile('proof.txt')).rejects.toThrow('另一个页面')
    expect(mock.request).not.toHaveBeenCalled()
  })
})
