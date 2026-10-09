import { hasExtensionMessageRuntime, sendExtensionMessage } from 'unas-src/platform/extension/extensionPlatform'

export type BrowserDownloadsFile = {
  id: number
  name: string
  state: 'in_progress' | 'complete' | 'interrupted'
  bytesReceived: number
  totalBytes: number
  exists?: boolean
  startTime?: string
}

type ListResponse = { ok: false; error: string } | { ok: true; items: BrowserDownloadsFile[] }

export async function listBrowserDownloadFiles() {
  if (!hasExtensionMessageRuntime()) throw new Error('浏览器下载记录仅在 uNAS 扩展中可用。')
  const response = await sendExtensionMessage({ kind: 'browser.downloads.files.list' }) as ListResponse
  if (!response?.ok) throw new Error(response?.error || '读取浏览器下载记录失败。')
  return response.items
}

export async function showBrowserDownloadFile(downloadId: number) {
  if (!hasExtensionMessageRuntime()) throw new Error('浏览器下载记录仅在 uNAS 扩展中可用。')
  const response = await sendExtensionMessage({ kind: 'browser.downloads.files.show', downloadId }) as { ok: boolean; error?: string }
  if (!response?.ok) throw new Error(response?.error || '无法在文件夹中显示此下载。')
}
