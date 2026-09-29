import { describe, expect, it, vi } from 'vitest'
import { EncryptedVaultCache, MemoryVaultCacheStore } from './local-cache'
import { VaultSyncEngine } from './sync-engine'
import { VaultConflictError, type VaultBackend } from '../../shared/vault'

function setup() {
  const cache = new EncryptedVaultCache(crypto.randomUUID(), new MemoryVaultCacheStore())
  const remote: VaultBackend = {
    connect: vi.fn(async () => {}),
    getManifest: vi.fn(async () => null),
    list: vi.fn(async () => []),
    get: vi.fn(async () => null),
    put: vi.fn(async (id) => ({ id, revision: 'remote-v1' })),
    delete: vi.fn(async () => {}),
  }
  return { cache, remote, engine: new VaultSyncEngine(cache, remote) }
}

describe('Vault synchronization failures', () => {
  it('never reports synced when a listed object disappears before GET', async () => {
    const { cache, remote, engine } = setup()
    vi.mocked(remote.list).mockResolvedValue([{ id: 'manifest', revision: 'v1' }])
    expect((await engine.synchronize()).state).toBe('offline')
    expect(await cache.getManifest()).toBeNull()
  })
  it('rejects explicit pull and preserves an existing cached object on missing GET', async () => {
    const { cache, remote, engine } = setup()
    await cache.acceptRemoteIfUnchanged({ id: 'manifest', data: new Uint8Array([1]), revision: 'v1' }, 'manifest', null)
    vi.mocked(remote.list).mockResolvedValue([{ id: 'manifest', revision: 'v2' }])
    await expect(engine.pull()).rejects.toThrow()
    expect((await cache.getManifest())?.data).toEqual(new Uint8Array([1]))
  })
  it('does not commit a partial pull if a later listed object is missing', async () => {
    const { cache, remote, engine } = setup()
    vi.mocked(remote.list).mockResolvedValue([{ id: 'manifest', revision: 'v1' }, { id: 'app_test', revision: 'v2' }])
    vi.mocked(remote.get).mockResolvedValueOnce({ id: 'manifest', data: new Uint8Array([1]), revision: 'v1' })
    expect((await engine.synchronize()).state).toBe('offline')
    expect(await cache.records()).toEqual([])
  })
  it('retains completed upload counts when a later upload fails', async () => {
    const { cache, remote, engine } = setup()
    await cache.put('manifest', new Uint8Array([1]))
    await cache.put('app_test', new Uint8Array([2]))
    vi.mocked(remote.put).mockResolvedValueOnce({ id: 'manifest', revision: 'v1' }).mockRejectedValueOnce(new Error('offline'))
    expect(await engine.synchronize()).toMatchObject({ state: 'offline', uploaded: 1, dirty: 1 })
    expect((await cache.record('manifest'))?.syncState).toBe('clean')
  })
  it('retains committed download counts when a later cache write fails', async () => {
    const { cache, remote, engine } = setup()
    vi.mocked(remote.list).mockResolvedValue([{ id: 'manifest', revision: 'v1' }, { id: 'app_test', revision: 'v2' }])
    vi.mocked(remote.get).mockImplementation(async (id) => ({ id, data: new Uint8Array([1]), revision: 'v1' }))
    const accept = cache.acceptRemoteIfUnchanged.bind(cache)
    vi.spyOn(cache, 'acceptRemoteIfUnchanged').mockImplementation(async (...args) => {
      if (args[0].id === 'app_test') throw new Error('quota exceeded')
      return accept(...args)
    })
    expect(await engine.synchronize()).toMatchObject({ state: 'offline', downloaded: 1 })
    expect(await cache.getManifest()).not.toBeNull()
    expect(await cache.record('app_test')).toBeUndefined()
  })

  it('preserves a local edit made while the replacement object is downloading', async () => {
    const { cache, remote, engine } = setup()
    await cache.acceptRemoteIfUnchanged({ id: 'manifest', data: new Uint8Array([1]), revision: 'v1' }, 'manifest', null)
    vi.mocked(remote.list).mockResolvedValue([{ id: 'manifest', revision: 'v2' }])
    vi.mocked(remote.get).mockImplementation(async (id) => {
      await cache.put(id, new Uint8Array([3]), (await cache.get(id))!.revision)
      return { id, data: new Uint8Array([2]), revision: 'v2' }
    })
    expect(await engine.synchronize()).toMatchObject({ state: 'pending', downloaded: 0, dirty: 1 })
    expect((await cache.getManifest())?.data).toEqual(new Uint8Array([3]))
  })

  it('keeps conflict semantics instead of overwriting the locally edited object', async () => {
    const { cache, remote, engine } = setup()
    await cache.put('manifest', new Uint8Array([1]))
    vi.mocked(remote.put).mockRejectedValue(new VaultConflictError())
    vi.mocked(remote.list).mockResolvedValue([{ id: 'manifest', revision: 'other' }])
    expect(await engine.synchronize()).toMatchObject({ state: 'conflict', uploaded: 0, conflicts: 1 })
    expect((await cache.getManifest())?.data).toEqual(new Uint8Array([1]))
    expect(remote.get).toHaveBeenCalledWith('manifest')
  })

  it('can retry after a missing object becomes available', async () => {
    const { cache, remote, engine } = setup()
    vi.mocked(remote.list).mockResolvedValue([{ id: 'manifest', revision: 'v1' }])
    await engine.synchronize()
    vi.mocked(remote.get).mockResolvedValue({ id: 'manifest', data: new Uint8Array([1]), revision: 'v1' })
    expect(await engine.synchronize()).toMatchObject({ state: 'synced', downloaded: 1 })
    expect((await cache.getManifest())?.data).toEqual(new Uint8Array([1]))
  })
})

describe('uncertain upload recovery', () => {
  it.each(['create', 'update'])('recovers a committed %s after its response is lost', async mode => {
    const { cache, remote, engine } = setup()
    if (mode === 'update') await cache.acceptRemoteIfUnchanged({ id: 'manifest', data: new Uint8Array([0]), revision: 'old' }, 'manifest', null)
    await cache.put('manifest', new Uint8Array([1, 2]), (await cache.getManifest())?.revision)
    vi.mocked(remote.put).mockRejectedValueOnce(new Error('response lost')).mockRejectedValue(new VaultConflictError())
    vi.mocked(remote.get).mockResolvedValue({ id: 'manifest', data: new Uint8Array([1, 2]), revision: 'committed' })
    vi.mocked(remote.list).mockResolvedValue([{ id: 'manifest', revision: 'committed' }])
    expect((await engine.synchronize()).state).toBe('offline')
    expect(await engine.synchronize()).toMatchObject({ state: 'synced', conflicts: 0, dirty: 0, uploaded: 0 })
    expect((await cache.record('manifest'))?.remoteRevision).toBe('committed')
  })

  it('recovers an identical object already marked as conflicted by an older build', async () => {
    const { cache, remote, engine } = setup()
    await cache.put('manifest', new Uint8Array([1]))
    const record = (await cache.record('manifest'))!
    await cache.markConflict(record.id, record.localRevision, record.remoteRevision)
    vi.mocked(remote.get).mockResolvedValue({ id: 'manifest', data: record.data, revision: 'committed' })
    vi.mocked(remote.list).mockResolvedValue([{ id: 'manifest', revision: 'committed' }])
    expect((await engine.synchronize()).state).toBe('synced')
    expect(remote.put).not.toHaveBeenCalled()
  })

  it('keeps a true conflict when remote ciphertext differs', async () => {
    const { cache, remote, engine } = setup()
    await cache.put('manifest', new Uint8Array([1]))
    vi.mocked(remote.put).mockRejectedValue(new VaultConflictError())
    vi.mocked(remote.get).mockResolvedValue({ id: 'manifest', data: new Uint8Array([2]), revision: 'other' })
    vi.mocked(remote.list).mockResolvedValue([{ id: 'manifest', revision: 'other' }])
    expect((await engine.synchronize()).state).toBe('conflict')
    expect((await engine.synchronize()).state).toBe('conflict')
    expect((await cache.getManifest())?.data).toEqual(new Uint8Array([1]))
    expect(remote.put).toHaveBeenCalledTimes(1)
  })

  it('preserves a newer local edit while acknowledging older committed bytes', async () => {
    const { cache, remote, engine } = setup()
    await cache.put('manifest', new Uint8Array([1]))
    vi.mocked(remote.put).mockRejectedValue(new VaultConflictError())
    vi.mocked(remote.get).mockImplementation(async () => {
      await cache.put('manifest', new Uint8Array([2]), (await cache.getManifest())!.revision)
      return { id: 'manifest', data: new Uint8Array([1]), revision: 'committed' }
    })
    vi.mocked(remote.list).mockResolvedValue([{ id: 'manifest', revision: 'committed' }])
    expect(await engine.synchronize()).toMatchObject({ state: 'pending', dirty: 1 })
    expect((await cache.getManifest())?.data).toEqual(new Uint8Array([2]))
    expect((await cache.record('manifest'))?.remoteRevision).toBe('committed')
  })

  it('can retry after the conflict verification GET fails', async () => {
    const { cache, remote, engine } = setup()
    await cache.put('manifest', new Uint8Array([1]))
    vi.mocked(remote.put).mockRejectedValue(new VaultConflictError())
    vi.mocked(remote.get).mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ id: 'manifest', data: new Uint8Array([1]), revision: 'committed' })
    vi.mocked(remote.list).mockResolvedValue([{ id: 'manifest', revision: 'committed' }])
    expect(await engine.synchronize()).toMatchObject({ state: 'offline', dirty: 1 })
    expect((await engine.synchronize()).state).toBe('synced')
  })
})

it('recovers a remote write when persisting its local acknowledgement failed', async () => {
  const { cache, remote, engine } = setup()
  await cache.put('manifest', new Uint8Array([1]))
  vi.mocked(remote.put).mockResolvedValueOnce({ id: 'manifest', revision: 'committed' }).mockRejectedValue(new VaultConflictError())
  vi.spyOn(cache, 'markUploaded').mockRejectedValueOnce(new Error('local transaction failed'))
  vi.mocked(remote.get).mockResolvedValue({ id: 'manifest', data: new Uint8Array([1]), revision: 'committed' })
  vi.mocked(remote.list).mockResolvedValue([{ id: 'manifest', revision: 'committed' }])
  expect((await engine.synchronize()).state).toBe('offline')
  expect((await engine.synchronize()).state).toBe('synced')
})
