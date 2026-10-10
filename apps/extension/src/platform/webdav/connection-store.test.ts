import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { connectionMaterial, deleteConnection, listConnections, serializeConnections, storeConnection } from './connection-store'
vi.mock('../crypto/deviceSecret', () => ({ sealDeviceSecret: vi.fn(async (value: unknown) => ({ encrypted: structuredClone(value) })), openDeviceSecret: vi.fn(async (value: { encrypted: unknown }) => value.encrypted) }))
let data: Record<string, unknown>
const input = { name: 'NAS', endpoint: 'https://nas.example/dav/', username: 'alice', appPassword: 'test-only' }
beforeEach(() => { data = {}; vi.stubGlobal('chrome', { storage: { local: { get: async (key: string) => structuredClone({ [key]: data[key] }), set: async (value: Record<string, unknown>) => { Object.assign(data, structuredClone(value)) } } } }) })
afterEach(() => vi.unstubAllGlobals())
describe('shared WebDAV connection store', () => {
  it('exposes metadata only and stores authentication without a Vault Key', async () => {
    const saved = await storeConnection(input)
    expect(await listConnections()).toEqual([saved])
    expect(saved).not.toHaveProperty('secret'); expect(saved).not.toHaveProperty('appPassword')
    expect(saved.vaultEndpoint).toBe(input.endpoint + '.unas-vault/')
    expect(await connectionMaterial(saved.id)).toEqual({ ...saved, username: input.username, appPassword: input.appPassword })
    expect(JSON.stringify(data)).not.toContain('vaultKey')
  })
  it('preserves blank authentication fields and rotates the revision on updates', async () => {
    const saved = await storeConnection(input)
    const next = await storeConnection({ ...input, id: saved.id, username: '', appPassword: '', name: 'Renamed' })
    expect(next.revision).not.toBe(saved.revision)
    expect((await connectionMaterial(next.id)).appPassword).toBe(input.appPassword)
    expect(await listConnections()).toHaveLength(1)
  })
  it('rejects duplicate endpoints, missing IDs and in-place server changes', async () => {
    const saved = await storeConnection(input)
    await expect(storeConnection(input)).rejects.toThrow('已有连接')
    await expect(storeConnection({ ...input, id: 'missing' })).rejects.toThrow('不存在')
    await expect(storeConnection({ ...input, id: saved.id, endpoint: 'https://other.example/' })).rejects.toThrow('更换服务器')
    expect(await listConnections()).toEqual([saved])
  })
  it('serializes read-modify-write operations and continues after a failed mutation', async () => {
    await Promise.all([serializeConnections(() => storeConnection(input)), serializeConnections(() => storeConnection({ ...input, endpoint: 'https://b.example/' }))])
    expect(await listConnections()).toHaveLength(2)
    await expect(serializeConnections(() => storeConnection(input))).rejects.toThrow('已有连接')
    const [first] = await listConnections()
    await serializeConnections(() => deleteConnection(first.id))
    await expect(connectionMaterial(first.id)).rejects.toThrow('已移除')
    expect(await listConnections()).toHaveLength(1)
  })
  it('rejects damaged metadata without leaking stored fields into projections', async () => {
    const saved = await storeConnection(input)
    const rows = data['unas-webdav-connections-v1'] as Array<Record<string, unknown>>
    rows[0].unexpected = 'private'
    expect(await listConnections()).toEqual([saved])
    rows[0].vaultEndpoint = 'https://other.example/vault/'
    await expect(listConnections()).rejects.toThrow('记录损坏')
    rows[0].vaultEndpoint = saved.vaultEndpoint
    rows[0].revision = 42
    await expect(listConnections()).rejects.toThrow('记录损坏')
  })
})
