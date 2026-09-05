export const WORKSPACE_APPS = ['file-manager', 'fetcher'] as const
export type WorkspaceApp = typeof WORKSPACE_APPS[number]
export type LaunchMessage = { schemaVersion: 1; action: 'workspace.launch'; appId: WorkspaceApp }
export function isWorkspaceApp(value: unknown): value is WorkspaceApp {
  return typeof value === 'string' && (WORKSPACE_APPS as readonly string[]).includes(value)
}
export function validateLaunchMessage(value: unknown, sender: { id?: string; url?: string; frameId?: number }, extensionId: string): value is LaunchMessage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const msg = value as Record<string, unknown>
  if (Object.keys(msg).sort().join(',') !== 'action,appId,schemaVersion' || msg.schemaVersion !== 1 || msg.action !== 'workspace.launch' || !isWorkspaceApp(msg.appId)) return false
  if (sender.id !== extensionId || (sender.frameId !== undefined && sender.frameId !== 0)) return false
  try {
    const url = new URL(sender.url || '')
    return url.protocol === 'chrome-extension:' && url.host === extensionId && ['/newtab.html', '/workspace.html'].includes(url.pathname)
  } catch { return false }
}
export interface WorkspaceTabsPort {
  discover(): Promise<{ tabId: number; windowId: number }[]>
  create(appId: WorkspaceApp): Promise<void>
  focus(tabId: number, windowId: number, appId: WorkspaceApp): Promise<void>
}
/** Serialize concurrent launch requests. The queue owns no task state. */
export function createWorkspaceRouter(port: WorkspaceTabsPort) {
  let queue = Promise.resolve()
  return (appId: WorkspaceApp) => {
    const result = queue.then(async () => {
      const contexts = [...new Map((await port.discover()).map((context) => [context.tabId, context])).values()]
      if (contexts.length > 1) throw new Error('检测到多个 Workspace。请关闭重复页面，在保留页面重新确认所有权后重试。')
      const [existing] = contexts
      if (existing) await port.focus(existing.tabId, existing.windowId, appId)
      else await port.create(appId)
    })
    queue = result.catch(() => {})
    return result
  }
}
