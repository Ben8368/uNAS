import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRecoverableVault, finishPendingCreation } from './pending-creation'
import { VaultCore } from './vault-core'
import { generateVaultKey, importVaultKey } from '../../shared/vault-crypto'
import { VaultConflictError, type StoredObject, type VaultBackend } from '../../shared/vault'

const journalKey = 'unipass-vault-pending-creations'
const endpoint = 'https://dav.example/vault/'
let local: Record<string, unknown>
beforeEach(() => {
  local = {}
  vi.stubGlobal('chrome', { storage: { local: {
    get: vi.fn(async (key: string) => structuredClone({ [key]: local[key] })),
    set: vi.fn(async (value: Record<string, unknown>) => { Object.assign(local, structuredClone(value)) }),
  } } })
})
afterEach(() => vi.unstubAllGlobals())
function backend() {
  const objects = new Map<string, StoredObject>()
  const remote: VaultBackend = {
    connect: async () => {},
    getManifest: async () => objects.get('manifest') ?? null,
    list: async () => [...objects.values()].map(({ id, revision }) => ({ id, revision })),
    get: async id => objects.get(id) ?? null,
    put: vi.fn(async (id, data) => {
      if (objects.has(id)) throw new VaultConflictError()
      objects.set(id, { id, data: data.slice(), revision: 'v1' })
      return { id, revision: 'v1' }
    }),
    delete: vi.fn(async () => {}),
  }
  return remote
}
const create = (remote: VaultBackend) => createRecoverableVault(remote, endpoint, 'synthetic-user', 'synthetic-password')

describe('durable encrypted creation journal', () => {
  it('persists only an encrypted envelope and can reopen the real encrypted manifest', async () => {
    const remote = backend()
    const result = await create(remote)
    expect(JSON.stringify(local[journalKey])).not.toContain(result.vaultKey)
    expect(JSON.stringify(local[journalKey])).not.toContain('synthetic-password')
    const opened = await VaultCore.open(remote, await importVaultKey(result.vaultKey))
    expect(opened.vaultId).toBe(result.core.vaultId)
    await finishPendingCreation(endpoint, 'unrelated-vault')
    expect(Object.keys(local[journalKey] as object)).toHaveLength(1)
    await finishPendingCreation(endpoint, opened.vaultId)
    expect(local[journalKey]).toEqual({})
  })

  it('resumes a committed manifest after its PUT response was lost and modules restart', async () => {
    const remote = backend()
    const put = remote.put
    vi.mocked(remote.put).mockImplementationOnce(async (...args) => {
      // Retain the normal backend write without recursively invoking the mock.
      const [id, data] = args
      const committed = { id, data: data.slice(), revision: 'v1' }
      remote.getManifest = async () => committed
      throw new Error('response lost')
    })
    await expect(create(remote)).rejects.toThrow('本地已保留加密恢复记录')
    const journal = structuredClone(local[journalKey])
    vi.resetModules()
    const restarted = await import('./pending-creation')
    const result = await restarted.createRecoverableVault(remote, endpoint, 'synthetic-user', 'synthetic-password')
    expect((await VaultCore.open(remote, await importVaultKey(result.vaultKey))).vaultId).toBe(result.core.vaultId)
    expect(local[journalKey]).toEqual(journal)
    expect(put).toHaveBeenCalledTimes(1)
  })

  it('reuses the pending key after failure before the remote write', async () => {
    const remote = backend()
    vi.mocked(remote.put).mockRejectedValueOnce(new Error('offline'))
    await expect(create(remote)).rejects.toThrow('本地已保留加密恢复记录')
    const journal = structuredClone(local[journalKey])
    const result = await create(remote)
    expect(local[journalKey]).toEqual(journal)
    expect((await VaultCore.open(remote, await importVaultKey(result.vaultKey))).vaultId).toBe(result.core.vaultId)
  })

  it('never overwrites an unrelated existing Vault without a pending attempt', async () => {
    const remote = backend()
    await VaultCore.create(crypto.randomUUID(), remote, await generateVaultKey())
    await expect(create(remote)).rejects.toThrow('已有密码库数据')
    expect(remote.put).toHaveBeenCalledTimes(1)
    expect(local[journalKey]).toBeUndefined()
  })

  it('preserves recovery material when another Vault appears at the pending endpoint', async () => {
    const remote = backend()
    vi.mocked(remote.put).mockRejectedValueOnce(new Error('offline'))
    await expect(create(remote)).rejects.toThrow()
    const journal = structuredClone(local[journalKey])
    await VaultCore.create(crypto.randomUUID(), remote, await generateVaultKey())
    const manifest = await remote.getManifest()
    await expect(create(remote)).rejects.toThrow('不会覆盖已有密码库')
    expect(local[journalKey]).toEqual(journal)
    expect(await remote.getManifest()).toEqual(manifest)
    expect(remote.delete).not.toHaveBeenCalled()
  })

  it('never writes remotely if sealing the device material fails', async () => {
    const remote = backend()
    vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error('device key write failed'))
    await expect(create(remote)).rejects.toThrow('device key write failed')
    expect(remote.put).not.toHaveBeenCalled()
  })
})
