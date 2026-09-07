import { validateLaunchMessage } from './workspaceRouter'

type ExtensionApi = {
  action: { onClicked: { addListener(listener: () => Promise<void>): void } }
  runtime: {
    id: string
    getURL(path: string): string
    onMessage: { addListener(listener: (message: unknown, sender: { id?: string; url?: string; frameId?: number }) => Promise<LaunchRejection>): void }
  }
  tabs: { create(options: { url: string; active?: boolean }): Promise<unknown> }
  storage?: {
    local: {
      get(key: string): Promise<Record<string, unknown>>
      set(values: Record<string, unknown>): Promise<void>
    }
    onChanged: {
      addListener(listener: (changes: Record<string, { newValue?: unknown }>, areaName: string) => void): void
      removeListener(listener: (changes: Record<string, { newValue?: unknown }>, areaName: string) => void): void
    }
  }
}

type LaunchRejection = { ok: false; error: string }

function api(): ExtensionApi | undefined {
  return (globalThis as typeof globalThis & { browser?: ExtensionApi }).browser
}

/** Keep extension persistence behind the adapter; Vite's standalone mock has no extension API. */
export function hasExtensionLocalStorage() {
  const storage = api()?.storage
  return Boolean(storage?.local && storage.onChanged)
}

export async function getExtensionLocalValue(key: string): Promise<unknown> {
  return (await api()?.storage?.local.get(key))?.[key]
}

export async function setExtensionLocalValue(key: string, value: unknown) {
  await api()?.storage?.local.set({ [key]: value })
}

export function subscribeExtensionLocalChanges(key: string, listener: () => void) {
  const changes = api()?.storage?.onChanged
  if (!changes) return () => {}
  const handle = (updates: Record<string, { newValue?: unknown }>, areaName: string) => {
    if (areaName === 'local' && Object.prototype.hasOwnProperty.call(updates, key)) listener()
  }
  changes.addListener(handle)
  return () => changes.removeListener(handle)
}

export function installToolbarAction() {
  const browser = api()
  if (!browser?.runtime?.id || !browser.action?.onClicked) return
  browser.action.onClicked.addListener(async () => {
    try { await browser.tabs.create({ url: browser.runtime.getURL('/newtab.html'), active: true }) }
    catch (error) { console.error('无法打开 uNAS 标签页', error) }
  })
}

/** Reject old page bundles instead of allowing them to create a second desktop. */
export function installWorkspaceRouter() {
  const browser = api()
  if (!browser?.runtime?.id) return
  browser.runtime.onMessage.addListener(async (message, sender) => {
    return { ok: false, error: validateLaunchMessage(message, sender, browser.runtime.id)
      ? 'App 已改为当前标签页打开，请刷新旧的 uNAS 页面后重试。'
      : '消息来源、版本或动作无效。' }
  })
}
export function isWorkspaceSurface() {
  return typeof location !== 'undefined' && (location.pathname === '/workspace.html' || new URLSearchParams(location.search).get('surface') === 'workspace')
}
