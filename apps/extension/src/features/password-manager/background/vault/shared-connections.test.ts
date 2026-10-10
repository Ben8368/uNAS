import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const calls = vi.hoisted(() => ({ backend: vi.fn() }))
vi.mock('./webdav-backend', () => ({ WebDavBackend: class { constructor(...args: unknown[]) { calls.backend(...args) } async connect() {} } }))
vi.mock('./vault-core', () => ({ VaultCore: class { static async open() { return { vaultId: 'old-vault' } } } }))
vi.mock('./local-cache', () => ({ EncryptedVaultCache: class { async clear() {} } }))
vi.mock('./sync-engine', () => ({ VaultSyncEngine: class { async synchronize() { return { state: 'synced', dirty: 0, conflicts: 0 } } } }))
vi.mock('../../shared/vault-crypto', () => ({ importVaultKey: vi.fn(async () => ({})) }))
vi.mock('./persistent-secrets', () => ({ sealPersistentMaterial: async (material: unknown) => ({ sealed: material }), openPersistentMaterial: async (envelope: { sealed: unknown }) => envelope.sealed }))
vi.mock('../../../../platform/crypto/deviceSecret', () => ({ sealDeviceSecret: async (material: unknown) => ({ sealed: material }), openDeviceSecret: async (envelope: { sealed: unknown }) => envelope.sealed }))
import { listConnections, storeConnection } from '../../../../platform/webdav/connection-store'
import { listVaultConnectionStates, lockVault, migrateWebDavConnections, saveWebDavVault } from './vault-service'
const pkey = 'unipass-vault-profiles', skey = 'unipass-vault-session-secrets', dkey = 'unipass-vault-persistent-connections'
const secret = { username: 'old-user', appPassword: 'old-pass', vaultKey: 'vault-private-key' }
let local: Record<string, unknown>, session: Record<string, unknown>
function storage(data: Record<string, unknown>) { return { get: async (key: string) => structuredClone({ [key]: data[key] }), set: async (value: Record<string, unknown>) => { Object.assign(data, structuredClone(value)) } } }
beforeEach(() => {
  calls.backend.mockClear()
  local = { [pkey]: [{ id: 'old-vault', name: 'Existing NAS', backend: 'webdav', enabled: true, endpoint: 'https://old.example/dav/' }], [dkey]: { 'old-vault': { sealed: secret } } }
  session = { [skey]: { 'old-vault': secret } }
  vi.stubGlobal('chrome', { storage: { local: storage(local), session: storage(session) }, permissions: { remove: vi.fn(async () => true) } })
})
afterEach(() => vi.unstubAllGlobals())
describe('Vault shared connection migration', () => {
  it('migrates locally and idempotently, preserves old paths, and stores only a connection reference beside the private key', async () => {
    await migrateWebDavConnections(); await migrateWebDavConnections()
    const [connection] = await listConnections()
    expect(await listConnections()).toHaveLength(1)
    expect(connection.vaultEndpoint).toBe('https://old.example/dav/')
    expect(local[dkey]).toEqual({ 'old-vault': { sealed: { username: '', appPassword: '', vaultKey: secret.vaultKey, connectionId: connection.id } } })
    expect(session[skey]).toEqual({ 'old-vault': { username: '', appPassword: '', vaultKey: secret.vaultKey, connectionId: connection.id } })
    expect(calls.backend).not.toHaveBeenCalled()
    expect(JSON.stringify(local['unas-webdav-connections-v1'])).not.toContain(secret.vaultKey)
  })
  it('uses updated shared credentials when reconnecting instead of the old Vault copy', async () => {
    await migrateWebDavConnections(); const [connection] = await listConnections()
    await storeConnection({ ...connection, username: 'new-user', appPassword: 'new-pass' })
    await saveWebDavVault({ mode: 'reconnect', vaultId: 'old-vault', name: 'NAS', endpoint: connection.vaultEndpoint, username: '', appPassword: '' })
    expect(calls.backend).toHaveBeenCalledWith(connection.vaultEndpoint, 'new-user', 'new-pass')
    expect(JSON.stringify(local[dkey])).not.toContain('new-pass')
  })
  it('preserves explicit Vault locking when migrating and after authentication changes', async () => {
    await lockVault('old-vault'); await migrateWebDavConnections()
    expect(session[skey]).toEqual({})
    expect(await listVaultConnectionStates()).toMatchObject([{ connected: false }])
  })
})
