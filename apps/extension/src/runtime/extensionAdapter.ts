import { createWorkspaceRouter, type LaunchMessage, type WorkspaceApp, validateLaunchMessage } from './workspaceRouter'

type RuntimeResponse = { ok: true } | { ok: false; error: string }
type ExtensionApi = {
  action: { onClicked: { addListener(listener: () => Promise<void>): void } }
  runtime: {
    id: string
    getURL(path: string): string
    getContexts?: (filter: { contextTypes: string[] }) => Promise<{ documentUrl?: string; tabId: number; windowId: number }[]>
    sendMessage(message: LaunchMessage): Promise<RuntimeResponse>
    onMessage: { addListener(listener: (message: unknown, sender: { id?: string; url?: string; frameId?: number }, respond: (response: RuntimeResponse) => void) => boolean | undefined): void }
  }
  tabs: { create(options: { url: string; active?: boolean }): Promise<{ id?: number; windowId: number }>; get(id: number): Promise<{ status?: string }>; update(id: number, options: { active: boolean; url: string }): Promise<unknown> }
  windows: { update(id: number, options: { focused: boolean }): Promise<unknown> }
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
export function installWorkspaceRouter() {
  const chrome = api()
  if (!chrome?.runtime?.id) return
  const workspaceUrl = chrome.runtime.getURL('/workspace.html')
  let openingTabId: number | undefined
  const route = createWorkspaceRouter({
    async discover() {
      if (!chrome.runtime.getContexts) throw new Error('当前浏览器缺少 Workspace 发现能力；请使用具备 runtime.getContexts 的 Chrome。')
      const contexts = await chrome.runtime.getContexts({ contextTypes: ['TAB'] })
      const workspaces = contexts.filter((context) => context.documentUrl?.split('#')[0] === workspaceUrl && context.tabId >= 0)
      if (workspaces.length) { openingTabId = undefined; return workspaces }
      if (openingTabId !== undefined) {
        let tab: { status?: string } | undefined
        try { tab = await chrome.tabs.get(openingTabId) } catch { openingTabId = undefined }
        if (tab && tab.status !== 'complete') throw new Error('上次请求的 Workspace 尚在加载。请等待，或关闭该标签页后重试；不会重复创建。')
        // A completed tab without an extension context is no longer our page.
        // Never navigate a cached tab id: leave the user's current page alone.
        openingTabId = undefined
      }
      return []
    },
    async create(appId) {
      const tab = await chrome.tabs.create({ url: `${workspaceUrl}#${appId}` })
      if (tab.id === undefined) throw new Error('Workspace 标签页尚未就绪，请重试。')
      openingTabId = tab.id
      // Do not cache a tab id: it can be closed or navigated to a user's website.
      // Await a discoverable extension document before servicing queued launches.
      for (let attempt = 0; attempt < 40; attempt++) {
        const contexts = await chrome.runtime.getContexts!({ contextTypes: ['TAB'] })
        if (contexts.some((context) => context.tabId === tab.id && context.documentUrl?.split('#')[0] === workspaceUrl)) { openingTabId = undefined; return }
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      throw new Error('Workspace 已请求打开，但页面尚未就绪；请等待页面加载后重试。')
    },
    async focus(tabId, windowId, appId) {
      await chrome.tabs.update(tabId, { active: true, url: `${workspaceUrl}#${appId}` })
      await chrome.windows.update(windowId, { focused: true })
    },
  })
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (!validateLaunchMessage(message, sender, chrome.runtime.id)) { respond({ ok: false, error: '消息来源、版本或动作无效。' }); return false }
    void route(message.appId).then(() => respond({ ok: true }), (error: unknown) => respond({ ok: false, error: error instanceof Error ? error.message : 'Workspace 启动失败' }))
    return true
  })
}
export function isWorkspaceSurface() {
  return typeof location !== 'undefined' && (location.pathname === '/workspace.html' || new URLSearchParams(location.search).get('surface') === 'workspace')
}
export async function launchWorkspace(appId: WorkspaceApp) {
  const chrome = api()
  if (chrome?.runtime?.id && location.protocol === 'chrome-extension:') {
    const response = await chrome.runtime.sendMessage({ schemaVersion: 1, action: 'workspace.launch', appId })
    if (!response?.ok) throw new Error(response?.error || 'Workspace 未响应，请重新加载扩展。')
    return
  }
  const url = new URL(location.href)
  url.searchParams.set('surface', 'workspace')
  url.hash = appId
  const workspace = window.open(url.href, 'unas-demo-workspace')
  if (!workspace) throw new Error('浏览器阻止打开演示 Workspace，请允许本地页面弹窗后重试。')
  workspace.focus()
}
