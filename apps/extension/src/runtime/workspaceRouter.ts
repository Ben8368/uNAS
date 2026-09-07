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
