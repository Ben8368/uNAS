import { validateLaunchMessage } from './workspaceRouter'
import { applyLinkMutation, isLinkMutation, parseLinks } from './linkApps'
import { extensionApi, getExtensionLocalValue, type ExtensionMessageSender, setExtensionLocalValue } from './extensionPlatform'

const LINK_STORAGE_KEY = 'unas-link-apps-v1'
type RuntimeResponse = { ok: false; error: string } | { ok: true; links: unknown }
let linkMutationTail = Promise.resolve()

function isExtensionPage(sender: ExtensionMessageSender, extensionId: string) {
  if (sender.id !== extensionId || (sender.frameId !== undefined && sender.frameId !== 0)) return false
  try {
    const url = new URL(sender.url || '')
    return url.protocol === 'chrome-extension:' && url.host === extensionId && ['/newtab.html', '/workspace.html'].includes(url.pathname)
  } catch { return false }
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
    return { ok: false, error: validateLaunchMessage(message, sender, runtime.id)
      ? 'App 已改为当前标签页打开，请刷新旧的 uNAS 页面后重试。'
      : '消息来源、版本或动作无效。' } as RuntimeResponse
  })
}
export function isWorkspaceSurface() {
  return typeof location !== 'undefined' && (location.pathname === '/workspace.html' || new URLSearchParams(location.search).get('surface') === 'workspace')
}
