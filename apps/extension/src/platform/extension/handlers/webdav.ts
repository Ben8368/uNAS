import type { WebDavSaveInput, WebDavSaveResult } from '#contracts'
import { listConnections, connectionMaterial, storeConnection, deleteConnection, serializeConnections } from '../../webdav/connection-store'
import { listVaultProfiles, migrateWebDavConnections, releaseUnusedWebDavPermission, removeVault, saveWebDavVault } from '../../../features/password-manager/background/vault/vault-service'
import { WebDavClient } from '../../webdav/client'
import { normalizeWebDavUrl, webDavPermissionOrigin } from '../../webdav/webdav-url'
import { defineRoute } from '../routes'
import { isExtensionPage } from '../sender-policy'
type Message = { kind: 'webdav.connection'; version: 1; action: string; input: unknown }
function object(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === 'object' && !Array.isArray(value)) }
function parseInput(value: unknown): WebDavSaveInput {
  if (!object(value) || Object.keys(value).some(key => !['id', 'name', 'endpoint', 'username', 'appPassword', 'consent', 'vaultKey'].includes(key)) || value.consent !== true || !['name', 'endpoint', 'username', 'appPassword'].every(key => typeof value[key] === 'string' && (value[key] as string).length <= 4096) || value.id !== undefined && (typeof value.id !== 'string' || value.id.length > 160) || value.vaultKey !== undefined && (typeof value.vaultKey !== 'string' || value.vaultKey.length > 4096)) throw new Error('WebDAV 连接字段或授权无效。')
  return value as WebDavSaveInput
}
function idFrom(value: unknown): string {
  if (!object(value) || typeof value.id !== 'string' || !value.id || value.id.length > 160) throw new Error('WebDAV 连接 ID 无效。')
  return value.id
}
async function requirePermission(endpoint: string) {
  if (!await chrome.permissions.contains({ origins: [webDavPermissionOrigin(endpoint)] })) throw new Error('WebDAV 主机权限已撤销，请在设置中重新保存连接。')
}
async function save(value: unknown): Promise<WebDavSaveResult> {
  const input = parseInput(value)
  const endpoint = normalizeWebDavUrl(input.endpoint)
  await requirePermission(endpoint)
  const previousProfile = input.id ? (await listConnections()).find(item => item.id === input.id) : undefined
  if (input.id && !previousProfile) throw new Error('WebDAV 连接不存在。')
  if (previousProfile && previousProfile.endpoint !== endpoint) throw new Error('更换服务器地址请添加新连接。')
  const previous = input.id && (!input.username.trim() || !input.appPassword) ? await connectionMaterial(input.id) : undefined
  const username = input.username.trim() || previous?.username || ''
  const appPassword = input.appPassword || previous?.appPassword || ''
  if (!username || !appPassword) throw new Error('请填写 WebDAV 用户名和应用密码。')
  const response = await new WebDavClient(endpoint, username, appPassword).request('PROPFIND', '', { headers: { Depth: '0' } })
  if (![200, 207].includes(response.status)) throw new Error('WebDAV 连接检查失败（HTTP ' + response.status + '）。')
  const connection = await storeConnection({ id: input.id, name: input.name, endpoint, username, appPassword })
  try {
    const profile = (await listVaultProfiles()).find(item => item.connectionId === connection.id)
    const vault = await saveWebDavVault({ connectionId: connection.id, mode: profile ? 'reconnect' : input.vaultKey?.trim() ? 'existing' : 'create', vaultId: profile?.id, name: connection.name, endpoint: connection.vaultEndpoint, username, appPassword, vaultKey: input.vaultKey })
    return { connection, vaultReady: true, recoveryKey: vault.recoveryKey }
  } catch (error) {
    return { connection, vaultReady: false, vaultError: error instanceof Error ? error.message : '密码库初始化失败，请重试。' }
  }
}
export const webDavRoute = defineRoute({
  matches: (message): message is Message => object(message) && message.kind === 'webdav.connection',
  authorize: isExtensionPage,
  rejection: 'WebDAV 连接请求仅允许来自 uNAS 顶层页面。',
  async handle(message) {
    try {
      if (message.version !== 1 || !['list', 'save', 'remove', 'acquire', 'check'].includes(message.action)) throw new Error('WebDAV 消息版本或动作无效。')
      return await serializeConnections(async () => {
        if (message.action === 'list') { await migrateWebDavConnections(); return { ok: true, data: await listConnections() } }
        if (message.action === 'save') return { ok: true, data: await save(message.input) }
        const id = idFrom(message.input)
        if (message.action === 'remove') {
          const target = (await listConnections()).find(item => item.id === id)
          for (const profile of await listVaultProfiles()) if (profile.connectionId === id) await removeVault(profile.id)
          await deleteConnection(id)
          if (target) await releaseUnusedWebDavPermission(target.endpoint)
          return { ok: true }
        }
        const connection = (await listConnections()).find(item => item.id === id)
        if (!connection) throw new Error('WebDAV 连接已移除。')
        await requirePermission(connection.endpoint)
        if (message.action === 'check') {
          if (!object(message.input) || message.input.revision !== connection.revision) throw new Error('WebDAV 配置已更新，请重新连接。')
          return { ok: true }
        }
        return { ok: true, data: await connectionMaterial(id) }
      })
    } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'WebDAV 操作失败。' } }
  },
})
