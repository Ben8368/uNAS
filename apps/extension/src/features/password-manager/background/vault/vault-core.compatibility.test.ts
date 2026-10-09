import { describe, expect, it } from 'vitest'
import { encryptVaultObject, generateVaultKey } from '../../shared/vault-crypto'
import type { StoredObject, StoredObjectMeta, VaultBackend, VaultObjectKind } from '../../shared/vault'
import { VaultConflictError, type VaultApp, type VaultAccount } from '../../shared/vault'
import { VaultCore } from './vault-core'

class MemoryBackend implements VaultBackend {
  private readonly objects = new Map<string, StoredObject>()
  private revision = 0

  async connect(): Promise<void> {}
  async getManifest(): Promise<StoredObject | null> { return this.get('manifest') }
  async list(): Promise<StoredObjectMeta[]> { return [...this.objects.values()].map(({ id, revision }) => ({ id, revision, kind: kindFor(id) })) }
  async get(id: string): Promise<StoredObject | null> {
    const object = this.objects.get(id)
    return object ? { ...object, data: object.data.slice() } : null
  }
  async put(id: string, data: Uint8Array, expectedRevision?: string): Promise<StoredObjectMeta> {
    const current = this.objects.get(id)
    if (expectedRevision !== undefined && current?.revision !== expectedRevision) throw new VaultConflictError()
    const next = { id, revision: String(++this.revision), data: data.slice() }
    this.objects.set(id, next)
    return { id: next.id, revision: next.revision, kind: kindFor(id) }
  }
  async delete(id: string, expectedRevision: string): Promise<void> {
    const current = this.objects.get(id)
    if (!current || current.revision !== expectedRevision) throw new VaultConflictError()
    this.objects.delete(id)
  }
}

describe('VaultCore compatibility', () => {
  it('opens an existing AES-256-GCM Vault, reads legacy credential fields, and round-trips an edit', async () => {
    const vaultId = 'legacy-vault-0001'
    const appId = 'legacy-app-00001'
    const accountId = 'legacy-account-001'
    const credentialId = 'legacy-credential-1'
    const backend = new MemoryBackend()
    const key = await generateVaultKey()
    const put = async (id: string, kind: VaultObjectKind, payload: unknown) => backend.put(id, await encryptVaultObject(key, id, kind, payload))
    await put('manifest', 'manifest', { vaultId, schemaVersion: 1 })
    const app: VaultApp = { id: appId, vaultId, name: 'Legacy site', targets: [{ scheme: 'https', host: 'legacy.example' }] }
    const account: VaultAccount = { id: accountId, vaultId, appId, username: 'legacy-user', credentialId, remark: 'old format' }
    await put(`app_${appId}`, 'app', app)
    await put(`account_${accountId}`, 'account', account)
    // Older objects included username in the encrypted credential payload. The
    // reader must accept it while the public credential result stays stable.
    await put(`credential_${credentialId}`, 'credential', { username: 'legacy-user', password: 'old-password' })

    const core = await VaultCore.open(backend, key)
    await expect(core.catalog()).resolves.toEqual({ apps: [app], accounts: [account] })
    await expect(core.credential({ vaultId, accountId })).resolves.toEqual({ username: 'legacy-user', password: 'old-password' })
    await core.updateCredential({ vaultId, accountId }, { password: 'new-password' })
    await expect(core.credential({ vaultId, accountId })).resolves.toEqual({ username: 'legacy-user', password: 'new-password' })
  })
})

function kindFor(id: string): VaultObjectKind | undefined {
  if (id === 'manifest') return 'manifest'
  if (id.startsWith('app_')) return 'app'
  if (id.startsWith('account_')) return 'account'
  if (id.startsWith('credential_')) return 'credential'
  return undefined
}
