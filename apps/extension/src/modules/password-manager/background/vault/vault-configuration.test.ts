import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WebDavBackend } from './webdav-backend'
import { disableLocalUnlock, enableLocalUnlock, lockVault, removeVault, saveWebDavVault, unlockVaultLocally } from './vault-service'

vi.mock('./webdav-backend', () => ({ WebDavBackend: class { async connect() {} } }))
vi.mock('./vault-core', () => ({ VaultCore: class {
  static async open() { return { vaultId: 'B' } }
  static async create(vaultId: string) { return { vaultId } }
} }))
vi.mock('./local-cache', () => ({ EncryptedVaultCache: class { async clear() {} } }))
vi.mock('./sync-engine', () => ({ VaultSyncEngine: class {
  async synchronize() { return { state: 'synced', dirty: 0, conflicts: 0 } }
} }))
vi.mock('../../shared/vault-crypto', () => ({ importVaultKey: vi.fn(async () => ({})), generateVaultKey: vi.fn(async () => ({})), exportVaultKey: vi.fn(async () => 'test-key') }))
vi.mock('./persistent-secrets', () => ({ sealPersistentMaterial: vi.fn(async (material: unknown) => ({ sealed: material })) }))
vi.mock('./local-unlock', () => ({
  sealLocalUnlockMaterial: vi.fn(async (_password: string, material: unknown) => ({ sealed: material })),
  openLocalUnlockMaterial: vi.fn(async () => { throw new Error('wrong password') }),
}))

const profilesKey = 'unipass-vault-profiles'
const persistentKey = 'unipass-vault-persistent-connections'
const unlocksKey = 'unipass-vault-local-unlocks'
const secretsKey = 'unipass-vault-session-secrets'
const failuresKey = 'unipass-vault-local-unlock-failures'
const secret = { username: 'test-user', appPassword: 'test-only', vaultKey: 'test-key' }
const profile = (id: string) => ({ id, name: id, backend: 'webdav', enabled: true, endpoint: `https://${id.toLowerCase()}.example/` })
let local: Record<string, unknown>
let session: Record<string, unknown>
function storage(data: Record<string, unknown>) {
  return {
    get: vi.fn(async (key: string) => structuredClone({ [key]: data[key] })),
    set: vi.fn(async (value: Record<string, unknown>) => { Object.assign(data, structuredClone(value)) }),
  }
}
const save = () => saveWebDavVault({ mode: 'existing', name: 'B updated', endpoint: 'https://b.example/', ...secret })

beforeEach(() => {
  local = { [profilesKey]: [profile('A'), profile('B')], [persistentKey]: { A: {}, B: {} }, [unlocksKey]: { A: {}, B: {} } }
  session = { [secretsKey]: { A: secret, B: secret } }
  vi.stubGlobal('chrome', { storage: { local: storage(local), session: storage(session) }, permissions: { remove: vi.fn(async () => true) } })
})
afterEach(() => vi.unstubAllGlobals())

describe('Vault configuration mutations', () => {
  it('does not restore profiles or secret material during concurrent removals', async () => {
    await Promise.all([removeVault('A'), removeVault('B')])
    expect(local[profilesKey]).toEqual([])
    expect(local[persistentKey]).toEqual({})
    expect(local[unlocksKey]).toEqual({})
    expect(session[secretsKey]).toEqual({})
  })

  it.each(['save-first', 'remove-first'])('preserves unrelated changes when saving and removing: %s', async (order) => {
    await Promise.all(order === 'save-first' ? [save(), removeVault('A')] : [removeVault('A'), save()])
    expect(local[profilesKey]).toEqual([{ ...profile('B'), name: 'B updated' }])
    expect(Object.keys(local[persistentKey] as object)).toEqual(['B'])
    expect(session[secretsKey]).toEqual({ B: secret })
  })

  it.each(['create', 'reconnect'] as const)('serializes %s with deletion of another Vault', async (mode) => {
    const saved = saveWebDavVault({ mode, ...(mode === 'reconnect' && { vaultId: 'B' }), name: 'saved', endpoint: 'https://b.example/', ...secret })
    const [connection] = await Promise.all([saved, removeVault('A')])
    expect((local[profilesKey] as Array<{ id: string }>).some(value => value.id === 'A')).toBe(false)
    expect((local[persistentKey] as Record<string, unknown>)[connection.profile.id]).toBeDefined()
    expect((session[secretsKey] as Record<string, unknown>).A).toBeUndefined()
  })

  it('releases the configuration queue when a connection fails', async () => {
    vi.spyOn(WebDavBackend.prototype, 'connect').mockRejectedValueOnce(new Error('network timeout'))
    const results = await Promise.allSettled([save(), removeVault('A')])
    expect(results.map(result => result.status)).toEqual(['rejected', 'fulfilled'])
    expect(local[profilesKey]).toEqual([profile('B')])
  })

  it('honors a removal queued after saving the same Vault', async () => {
    await Promise.all([save(), removeVault('B')])
    expect(local[profilesKey]).toEqual([profile('A')])
    expect(session[secretsKey]).toEqual({ A: secret })
    expect(local[persistentKey]).toEqual({ A: {} })
  })

  it('does not restore sessions when locking two Vaults concurrently', async () => {
    await Promise.all([lockVault('A'), lockVault('B')])
    expect(session[secretsKey]).toEqual({})
  })

  it('serializes local-unlock material changes with removal', async () => {
    await Promise.all([enableLocalUnlock('A', 'test-password'), removeVault('A'), disableLocalUnlock('B')])
    expect(local[unlocksKey]).toEqual({})
    expect(session[secretsKey]).toEqual({ B: secret })
  })

  it('counts concurrent failed unlocks and enforces the existing five-attempt limit', async () => {
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => unlockVaultLocally('A', 'wrong')))
    expect(results.every(result => result.status === 'rejected')).toBe(true)
    expect(session[failuresKey]).toEqual({ A: 5 })
    expect(results[5]).toMatchObject({ status: 'rejected', reason: new Error('本地解锁已锁定，请重新连接该 Vault') })
  })

  it('continues processing after a storage write rejects', async () => {
    vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error('storage unavailable'))
    const results = await Promise.allSettled([removeVault('A'), removeVault('B')])
    expect(results.map(result => result.status)).toEqual(['rejected', 'fulfilled'])
    expect(local[profilesKey]).toEqual([profile('A')])
  })
})
