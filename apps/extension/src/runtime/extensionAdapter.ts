import { validateLaunchMessage } from './workspaceRouter'
import { applyLinkMutation, isLinkMutation, parseLinks } from './linkApps'
import { extensionApi, getExtensionLocalValue, type ExtensionMessageSender, setExtensionLocalValue } from './extensionPlatform'
import { isAllowedBrowserDownloadUrl } from './browserDownloads'

const LINK_STORAGE_KEY = 'unas-link-apps-v1'
type RuntimeResponse = { ok: false; error: string } | { ok: true; links?: unknown; downloadId?: number; download?: unknown; downloads?: unknown[] }
let linkMutationTail = Promise.resolve()
const BROWSER_DOWNLOAD_STORAGE_KEY = 'unas-browser-downloads-v1'

function isExtensionPage(sender: ExtensionMessageSender, extensionId: string) {
  if (sender.id !== extensionId || (sender.frameId !== undefined && sender.frameId !== 0)) return false
  try {
    const url = new URL(sender.url || '')
    return url.protocol === 'chrome-extension:' && url.host === extensionId && ['/newtab.html', '/workspace.html'].includes(url.pathname)
  } catch { return false }
}

function isBrowserDownloadMessage(message: unknown): message is { kind: 'browser.download'; url: string } | { kind: 'browser.download.get'; downloadId: number } | { kind: 'browser.download.cancel'; downloadId: number } | { kind: 'browser.download.forget'; downloadId: number } | { kind: 'browser.download.list' } | { kind: 'browser.download.show' } {
  if (!message || typeof message !== 'object' || Array.isArray(message)) return false
  const value = message as Record<string, unknown>
  if (value.kind === 'browser.download') {
    if (typeof value.url !== 'string' || value.url.length > 4096) return false
    return isAllowedBrowserDownloadUrl(value.url)
  }
  if (value.kind === 'browser.download.list' || value.kind === 'browser.download.show') return true
  return (value.kind === 'browser.download.get' || value.kind === 'browser.download.cancel' || value.kind === 'browser.download.forget') && Number.isInteger(value.downloadId) && Number(value.downloadId) >= 0
}

async function handleBrowserDownload(message: { kind: 'browser.download'; url: string } | { kind: 'browser.download.get'; downloadId: number } | { kind: 'browser.download.cancel'; downloadId: number } | { kind: 'browser.download.forget'; downloadId: number } | { kind: 'browser.download.list' } | { kind: 'browser.download.show' }): Promise<RuntimeResponse> {
  const downloads = extensionApi()?.downloads
  if (!downloads) return { ok: false, error: 'Chrome downloads API 不可用；请确认扩展已重新加载并启用下载功能。' }
  try {
    if (message.kind === 'browser.download') {
      const downloadId = await downloads.download({ url: message.url, conflictAction: 'uniquify', saveAs: false })
      const stored = await getExtensionLocalValue(BROWSER_DOWNLOAD_STORAGE_KEY)
      const records = Array.isArray(stored) ? stored.filter((item): item is { downloadId: number; url: string; createdAt: number } => Boolean(item && typeof item === 'object' && Number.isInteger((item as Record<string, unknown>).downloadId) && typeof (item as Record<string, unknown>).url === 'string' && typeof (item as Record<string, unknown>).createdAt === 'number')) : []
      await setExtensionLocalValue(BROWSER_DOWNLOAD_STORAGE_KEY, [...records, { downloadId, url: message.url, createdAt: Date.now() }].slice(-200))
      return { ok: true, downloadId }
    }
    if (message.kind === 'browser.download.cancel') {
      await downloads.cancel(message.downloadId)
      return { ok: true }
    }
    if (message.kind === 'browser.download.forget') {
      const stored = await getExtensionLocalValue(BROWSER_DOWNLOAD_STORAGE_KEY)
      const records = Array.isArray(stored) ? stored.filter(item => !(item && typeof item === 'object' && (item as Record<string, unknown>).downloadId === message.downloadId)) : []
      await setExtensionLocalValue(BROWSER_DOWNLOAD_STORAGE_KEY, records)
      return { ok: true }
    }
    if (message.kind === 'browser.download.list') {
      const stored = await getExtensionLocalValue(BROWSER_DOWNLOAD_STORAGE_KEY)
      const downloads = Array.isArray(stored) ? stored.filter((item): item is { downloadId: number; url: string; createdAt: number } => Boolean(item && typeof item === 'object' && Number.isInteger((item as Record<string, unknown>).downloadId) && typeof (item as Record<string, unknown>).url === 'string' && typeof (item as Record<string, unknown>).createdAt === 'number')) : []
      return { ok: true, downloads }
    }
    if (message.kind === 'browser.download.show') {
      await extensionApi()?.tabs?.create({ url: 'chrome://downloads/', active: true })
      return { ok: true }
    }
    const [download] = await downloads.search({ id: message.downloadId })
    if (!download) return { ok: true, download: undefined }
    return { ok: true, download: { id: download.id, state: download.state, bytesReceived: download.bytesReceived, totalBytes: download.totalBytes, error: download.error } }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Chrome 下载操作失败。' }
  }
}
async function mutateLinks(message: unknown): Promise<RuntimeResponse> {
  const update = async () => {
    try {
      const stored = await getExtensionLocalValue(LINK_STORAGE_KEY)
      if (isLinkMutation(message) && message.kind === 'migrate' && stored !== undefined) return { ok: true, links: parseLinks(stored) } as const
      const current = parseLinks(stored ?? [])
      const links = applyLinkMutation(current, message)
      await setExtensionLocalValue(LINK_STORAGE_KEY, links)
      return { ok: true, links } as const
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Link App 更新失败。' } as const
    }
  }
  const result = linkMutationTail.then(update, update)
  linkMutationTail = result.then(() => undefined, () => undefined)
  return await result
}

export function installToolbarAction() {
  const browser = extensionApi()
  const runtime = browser?.runtime
  const tabs = browser?.tabs
  if (!runtime?.id || !browser?.action?.onClicked || !tabs) return
  browser.action.onClicked.addListener(async () => {
    try { await tabs.create({ url: runtime.getURL('/newtab.html'), active: true }) }
    catch (error) { console.error('无法打开 uNAS 标签页', error) }
  })
}

/** Reject old page bundles instead of allowing them to create a second desktop. */
export function installWorkspaceRouter() {
  const browser = extensionApi()
  const runtime = browser?.runtime
  if (!runtime?.id) return
  runtime.onMessage.addListener(async (message, sender) => {
    if (isLinkMutation(message) && isExtensionPage(sender, runtime.id)) return await mutateLinks(message)
    if (isBrowserDownloadMessage(message) && isExtensionPage(sender, runtime.id)) return await handleBrowserDownload(message)
    return { ok: false, error: validateLaunchMessage(message, sender, runtime.id)
      ? 'App 已改为当前标签页打开，请刷新旧的 uNAS 页面后重试。'
      : '消息来源、版本或动作无效。' } as RuntimeResponse
  })
}
export function isWorkspaceSurface() {
  return typeof location !== 'undefined' && (location.pathname === '/workspace.html' || new URLSearchParams(location.search).get('surface') === 'workspace')
}
