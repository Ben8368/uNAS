import type { WebDavConnection } from '#contracts'
import { openDeviceSecret, sealDeviceSecret, type DeviceSecretEnvelope } from '../crypto/deviceSecret'
import { normalizeWebDavUrl } from './webdav-url'
const KEY = 'unas-webdav-connections-v1'
type StoredConnection = WebDavConnection & { secret: DeviceSecretEnvelope }
export type ConnectionMaterial = WebDavConnection & { username: string; appPassword: string }
let tail: Promise<unknown> = Promise.resolve()
export function serializeConnections<T>(action: () => Promise<T>): Promise<T> {
  const next = tail.then(action); tail = next.catch(() => undefined); return next
}
async function records(): Promise<StoredConnection[]> {
  const value = (await chrome.storage.local.get(KEY))[KEY]
  if (value === undefined) return []
  if (!Array.isArray(value) || !value.every(validRecord)) throw new Error('WebDAV 连接记录损坏，请恢复本地备份。')
  return value as StoredConnection[]
}
function validRecord(value: unknown): value is StoredConnection {
  const row = value as StoredConnection
  if (!row || !row.secret || !['id', 'name', 'endpoint', 'revision', 'vaultEndpoint'].every(key => typeof row[key as keyof StoredConnection] === 'string')) return false
  try { return normalizeWebDavUrl(row.endpoint) === row.endpoint && [row.endpoint, row.endpoint + '.unas-vault/'].includes(row.vaultEndpoint) } catch { return false }
}
function metadata(record: StoredConnection): WebDavConnection {
  return { id: record.id, name: record.name, endpoint: record.endpoint, revision: record.revision, vaultEndpoint: record.vaultEndpoint }
}
export async function listConnections(): Promise<WebDavConnection[]> { return (await records()).map(metadata) }
export async function connectionMaterial(id: string): Promise<ConnectionMaterial> {
  const record = (await records()).find(row => row.id === id)
  if (!record) throw new Error('WebDAV 连接已移除，请重新选择。')
  const secret = await openDeviceSecret(record.secret) as { username?: unknown; appPassword?: unknown }
  if (typeof secret?.username !== 'string' || !secret.username || typeof secret.appPassword !== 'string' || !secret.appPassword) throw new Error('WebDAV 认证信息不可用，请在设置中重新保存连接。')
  return { ...metadata(record), username: secret.username, appPassword: secret.appPassword }
}
/** Caller serializes the entire mutation and any dependent Vault setup. */
export async function storeConnection(input: { id?: string; name: string; endpoint: string; username: string; appPassword: string; vaultEndpoint?: string }): Promise<WebDavConnection> {
  const rows = await records()
  const previous = input.id ? rows.find(row => row.id === input.id) : undefined
  if (input.id && !previous) throw new Error('WebDAV 连接不存在。')
  const endpoint = normalizeWebDavUrl(input.endpoint)
  if (previous && endpoint !== previous.endpoint) throw new Error('更换服务器地址请添加新连接，避免将已有密码库写入其他位置。')
  if (rows.some(row => row.endpoint === endpoint && row.id !== input.id)) throw new Error('此 WebDAV 地址已有连接，请选择该连接进行修改。')
  const saved = previous && (!input.username || !input.appPassword) ? await connectionMaterial(previous.id) : undefined
  const username = input.username.trim() || saved?.username || ''
  const appPassword = input.appPassword || saved?.appPassword || ''
  if (!username || !appPassword) throw new Error('请填写 WebDAV 用户名和应用密码。')
  const record: StoredConnection = { id: previous?.id ?? crypto.randomUUID(), name: input.name.trim() || new URL(endpoint).hostname, endpoint, revision: crypto.randomUUID(), vaultEndpoint: previous?.vaultEndpoint ?? input.vaultEndpoint ?? endpoint + '.unas-vault/', secret: await sealDeviceSecret({ username, appPassword }) }
  await chrome.storage.local.set({ [KEY]: [...rows.filter(row => row.id !== record.id), record] })
  return metadata(record)
}
export async function deleteConnection(id: string) { await chrome.storage.local.set({ [KEY]: (await records()).filter(row => row.id !== id) }) }
