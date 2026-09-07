import { validateLaunchMessage } from './workspaceRouter'

type ExtensionApi = {
  action: { onClicked: { addListener(listener: () => Promise<void>): void } }
  runtime: {
    id: string
    getURL(path: string): string
    onMessage: { addListener(listener: (message: unknown, sender: { id?: string; url?: string; frameId?: number }, respond: (response: { ok: false; error: string }) => void) => boolean): void }
  }
  tabs: { create(options: { url: string; active?: boolean }): Promise<unknown> }
}
function api(): ExtensionApi | undefined {
  return (globalThis as typeof globalThis & { chrome?: ExtensionApi }).chrome
}
export function installToolbarAction() {
  const chrome = api()
  if (!chrome?.runtime?.id || !chrome.action?.onClicked) return
  chrome.action.onClicked.addListener(async () => {
    try { await chrome.tabs.create({ url: chrome.runtime.getURL('/newtab.html'), active: true }) }
    catch (error) { console.error('无法打开 uNAS 标签页', error) }
  })
}
/** Reject old page bundles instead of allowing them to create a second desktop. */
export function installWorkspaceRouter() {
  const chrome = api()
  if (!chrome?.runtime?.id) return
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    respond({ ok: false, error: validateLaunchMessage(message, sender, chrome.runtime.id)
      ? 'App 已改为当前标签页打开，请刷新旧的 uNAS 页面后重试。'
      : '消息来源、版本或动作无效。' })
    return false
  })
}
export function isWorkspaceSurface() {
  return typeof location !== 'undefined' && (location.pathname === '/workspace.html' || new URLSearchParams(location.search).get('surface') === 'workspace')
}
