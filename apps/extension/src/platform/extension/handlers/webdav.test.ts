import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ permission: vi.fn(), saveVault: vi.fn(), removeVault: vi.fn(), profiles: vi.fn(), migrate: vi.fn(), request: vi.fn() }))
vi.mock('../../../features/password-manager/background/vault/vault-service', () => ({ saveWebDavVault: mock.saveVault, removeVault: mock.removeVault, listVaultProfiles: mock.profiles, releaseUnusedWebDavPermission: vi.fn(async () => undefined), migrateWebDavConnections: mock.migrate }))
vi.mock('../../webdav/client', () => ({ WebDavClient: class { request = mock.request } }))
vi.mock('../../crypto/deviceSecret', () => ({ sealDeviceSecret: async (value: unknown) => ({ encrypted: value }), openDeviceSecret: async (value: { encrypted: unknown }) => value.encrypted }))
import { webDavRoute } from './webdav'
import { connectionMaterial, listConnections } from '../../webdav/connection-store'
let data: Record<string, unknown>
const input = { name: 'NAS', endpoint: 'https://nas.example/dav/', username: 'alice', appPassword: 'secret-fixture', consent: true }
const call = (action: string, value: unknown = {}) => webDavRoute.handle({ kind: 'webdav.connection', version: 1, action, input: value }, {}, {} as never) as Promise<{ ok: boolean; data?: Record<string, unknown>; error?: string }>
beforeEach(() => {
  vi.resetAllMocks(); data = {}
  mock.profiles.mockResolvedValue([]); mock.migrate.mockResolvedValue(undefined)
  mock.permission.mockResolvedValue(true)
  mock.request.mockResolvedValue({ status: 207 }); mock.saveVault.mockResolvedValue({ profile: { id: 'vault' }, recoveryKey: 'vault-only-key' })
  vi.stubGlobal('chrome', { storage: { local: { get: async (key: string) => structuredClone({ [key]: data[key] }), set: async (value: Record<string, unknown>) => { Object.assign(data, structuredClone(value)) } } }, permissions: { contains: mock.permission } })
})
afterEach(() => vi.unstubAllGlobals())
describe('project WebDAV service', () => {
  it('only authorizes the top-level project pages', () => {
    for (const sender of [{ id: 'x', url: 'https://site.example/' }, { id: 'x', url: 'chrome-extension://x/newtab.html', frameId: 1 }, { id: 'y', url: 'chrome-extension://x/newtab.html' }, { id: 'x', url: 'chrome-extension://x/popup.html' }]) expect(webDavRoute.authorize(sender, 'x', {})).toBe(false)
    expect(webDavRoute.authorize({ id: 'x', url: 'chrome-extension://x/newtab.html#settings', frameId: 0 }, 'x', {})).toBe(true)
  })
  it('saves one connection and automatically initializes a separate Vault directory', async () => {
    const saved = await call('save', input)
    expect(saved).toMatchObject({ ok: true, data: { vaultReady: true, recoveryKey: 'vault-only-key' } })
    const [connection] = await listConnections()
    expect(mock.saveVault).toHaveBeenCalledWith(expect.objectContaining({ connectionId: connection.id, endpoint: input.endpoint + '.unas-vault/', mode: 'create' }))
    const acquired = await call('acquire', { id: connection.id })
    expect(acquired.data?.appPassword).toBe(input.appPassword)
    expect(acquired.data).not.toHaveProperty('vaultKey')
    expect(JSON.stringify(await call('list'))).not.toContain(input.appPassword)
    expect(JSON.stringify(await call('list'))).not.toContain('vault-only-key')
  })
  it('reports partial success and keeps the connection when Vault initialization fails', async () => {
    mock.saveVault.mockRejectedValueOnce(new Error('已有密码库，需要恢复密钥'))
    const result = await call('save', input)
    expect(result).toMatchObject({ ok: true, data: { vaultReady: false, vaultError: '已有密码库，需要恢复密钥' } })
    expect(await listConnections()).toHaveLength(1)
  })
  it('recovers damaged authentication by replacing both fields', async () => {
    await call('save', input)
    const [connection] = await listConnections()
    const rows = data['unas-webdav-connections-v1'] as Array<Record<string, unknown>>
    rows[0].secret = { encrypted: null }
    expect((await call('save', { ...input, id: connection.id, username: '', appPassword: '' })).ok).toBe(false)
    expect((await call('save', { ...input, id: connection.id, username: 'recovered', appPassword: 'replacement' })).ok).toBe(true)
    expect(await connectionMaterial(connection.id)).toMatchObject({ username: 'recovered', appPassword: 'replacement' })
  })
  it('retains existing credentials on failed connection checks and rejects old sessions after update', async () => {
    await call('save', input); const [original] = await listConnections()
    mock.request.mockResolvedValueOnce({ status: 401 })
    expect((await call('save', { ...input, id: original.id, appPassword: 'bad' })).ok).toBe(false)
    expect((await connectionMaterial(original.id)).appPassword).toBe(input.appPassword)
    await call('save', { ...input, id: original.id, appPassword: 'updated' })
    expect(await call('check', { id: original.id, revision: original.revision })).toMatchObject({ ok: false, error: expect.stringContaining('已更新') })
  })
  it('rejects malformed payloads, absent consent and revoked host permission before network access', async () => {
    for (const value of [null, {}, { ...input, consent: false }, { ...input, appPassword: 42 }, { ...input, vaultEndpoint: 'https://other.example/vault/' }]) expect((await call('save', value)).ok).toBe(false)
    mock.permission.mockResolvedValue(false)
    expect((await call('save', input)).ok).toBe(false)
    expect(mock.request).not.toHaveBeenCalled()
  })
  it('removes linked Vault configuration and invalidates acquisition without deleting remote files', async () => {
    await call('save', input); const [connection] = await listConnections()
    mock.profiles.mockResolvedValue([{ id: 'vault', connectionId: connection.id }, { id: 'unrelated' }])
    mock.request.mockClear()
    expect(await call('remove', { id: connection.id })).toEqual({ ok: true })
    expect(mock.removeVault).toHaveBeenCalledExactlyOnceWith('vault')
    expect((await call('acquire', { id: connection.id })).ok).toBe(false)
    expect(mock.request).not.toHaveBeenCalled()
  })
})
