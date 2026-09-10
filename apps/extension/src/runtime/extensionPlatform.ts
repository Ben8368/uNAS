type ExtensionApi = {
  action?: { onClicked: { addListener(listener: () => Promise<void>): void } }
  runtime?: {
    id: string
    getURL(path: string): string
    sendMessage(message: unknown): Promise<unknown>
    onMessage: { addListener(listener: (message: unknown, sender: ExtensionMessageSender) => Promise<unknown>): void }
  }
  tabs?: { create(options: { url: string; active?: boolean }): Promise<unknown> }
  downloads?: {
    download(options: { url: string; conflictAction?: 'uniquify' | 'overwrite' | 'prompt'; saveAs?: boolean }): Promise<number>
    search(query: { id: number }): Promise<Array<{ id: number; state: 'in_progress' | 'complete' | 'interrupted'; bytesReceived: number; totalBytes: number; filename?: string; error?: string }>>
    cancel(downloadId: number): Promise<void>
  }
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

export type ExtensionMessageSender = { id?: string; url?: string; frameId?: number }

export function extensionApi(): ExtensionApi | undefined {
  return (globalThis as typeof globalThis & { browser?: ExtensionApi }).browser
}

export function hasExtensionLocalStorage() {
  const storage = extensionApi()?.storage
  return Boolean(storage?.local && storage.onChanged)
}

export function hasExtensionMessageRuntime() {
  const runtime = extensionApi()?.runtime
  return Boolean(runtime?.id && runtime.sendMessage)
}

export async function getExtensionLocalValue(key: string): Promise<unknown> {
  const local = extensionApi()?.storage?.local
  if (!local) throw new Error('扩展本地存储不可用。')
  return (await local.get(key))[key]
}

export async function setExtensionLocalValue(key: string, value: unknown) {
  const local = extensionApi()?.storage?.local
  if (!local) throw new Error('扩展本地存储不可用。')
  await local.set({ [key]: value })
}

export async function sendExtensionMessage(message: unknown): Promise<unknown> {
  const runtime = extensionApi()?.runtime
  if (!runtime?.sendMessage) throw new Error('扩展消息运行时不可用。')
  return await runtime.sendMessage(message)
}

export function subscribeExtensionLocalChanges(key: string, listener: () => void) {
  const changes = extensionApi()?.storage?.onChanged
  if (!changes) return () => {}
  const handle = (updates: Record<string, { newValue?: unknown }>, areaName: string) => {
    if (areaName === 'local' && Object.prototype.hasOwnProperty.call(updates, key)) listener()
  }
  changes.addListener(handle)
  return () => changes.removeListener(handle)
}
