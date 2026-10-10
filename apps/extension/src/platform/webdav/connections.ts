import type { WebDavConnection, WebDavSaveInput, WebDavSaveResult } from '#contracts'
import { extensionApi, sendExtensionMessage, subscribeExtensionLocalChanges } from '../extension/extensionPlatform'
import { normalizeWebDavUrl, webDavPermissionOrigin } from './webdav-url'
export type { WebDavConnection, WebDavSaveInput, WebDavSaveResult } from '#contracts'
async function request<T>(action: string, input: unknown = {}): Promise<T> {
  const response = await sendExtensionMessage({ kind: 'webdav.connection', version: 1, action, input }) as { ok: boolean; data?: T; error?: string }
  if (!response?.ok) throw new Error(response?.error || 'WebDAV 服务未响应。')
  return response.data as T
}
export const webDavConnections = {
  subscribe: (listener: () => void) => subscribeExtensionLocalChanges('unas-webdav-connections-v1', listener),
  list: () => request<WebDavConnection[]>('list'),
  async save(input: WebDavSaveInput) {
    if (!input.consent) throw new Error('请确认保存并共用此 WebDAV 连接。')
    const endpoint = normalizeWebDavUrl(input.endpoint)
    if (!await extensionApi()?.permissions?.request({ origins: [webDavPermissionOrigin(endpoint)] })) throw new Error('未授予 WebDAV 主机权限。')
    return request<WebDavSaveResult>('save', { ...input, endpoint })
  },
  remove: (id: string) => request<void>('remove', { id }),
}
/** Only adapters consume this; the service never returns Vault Key. */
export const acquireWebDavConnection = (id: string) => request<WebDavConnection & { username: string; appPassword: string }>('acquire', { id })
export const checkWebDavConnection = (id: string, revision: string) => request<void>('check', { id, revision })
