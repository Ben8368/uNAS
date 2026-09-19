import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearVaultSyncReady, isVaultSyncReady, markVaultSyncReady } from './sync-readiness'

const key = 'unipass-vault-sync-readiness'
let stored: Record<string, unknown>
beforeEach(() => {
  stored = {}
  vi.stubGlobal('chrome', { storage: { local: {
    get: vi.fn(async () => structuredClone(stored)),
    set: vi.fn(async (next: Record<string, unknown>) => { Object.assign(stored, structuredClone(next)) }),
  } } })
})
afterEach(() => vi.unstubAllGlobals())

describe('sync readiness mutations', () => {
  it('keeps both Vaults ready when sync completes concurrently', async () => {
    await Promise.all([markVaultSyncReady('A'), markVaultSyncReady('B')])
    expect(await isVaultSyncReady('A')).toBe(true)
    expect(await isVaultSyncReady('B')).toBe(true)
  })
  it('does not restore cleared state when another Vault finishes syncing', async () => {
    stored[key] = { A: true }
    await Promise.all([clearVaultSyncReady('A'), markVaultSyncReady('B')])
    expect(stored[key]).toEqual({ B: true })
  })
  it('orders clear after mark for the same Vault', async () => {
    await Promise.all([markVaultSyncReady('A'), clearVaultSyncReady('A')])
    expect(await isVaultSyncReady('A')).toBe(false)
  })
  it('allows subsequent updates after a rejected write', async () => {
    vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error('storage full'))
    const results = await Promise.allSettled([markVaultSyncReady('A'), markVaultSyncReady('B')])
    expect(results.map(result => result.status)).toEqual(['rejected', 'fulfilled'])
    expect(stored[key]).toEqual({ B: true })
  })
})
