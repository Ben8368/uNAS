import { hasExtensionMessageRuntime, sendExtensionMessage } from './extensionPlatform'

export type BrowserDownloadStatus = 'in_progress' | 'complete' | 'interrupted'
export type BrowserDownloadInfo = {
  id: number
  state: BrowserDownloadStatus
  bytesReceived: number
  totalBytes: number
  filename?: string
  error?: string
}
export type BrowserDownloadRecord = { downloadId: number; url: string; createdAt: number }

type BrowserDownloadResponse = { ok: false; error: string } | { ok: true; downloadId: number }
type BrowserDownloadInfoResponse = { ok: false; error: string } | { ok: true; download?: BrowserDownloadInfo }
type BrowserDownloadListResponse = { ok: false; error: string } | { ok: true; downloads: BrowserDownloadRecord[] }

const directDownloadExtensions = new Set([
  '3gp', 'aac', 'avi', 'flac', 'flv', 'gif', 'jpeg', 'jpg', 'm4a', 'm4v', 'mkv', 'mov', 'mp3', 'mp4',
  '7z', 'apk', 'bin', 'csv', 'deb', 'dmg', 'doc', 'docx', 'exe', 'gz', 'iso', 'msi', 'mpeg', 'mpg',
  'oga', 'ogg', 'ogv', 'opus', 'pdf', 'pkg', 'rar', 'rpm', 'tar', 'ts', 'txt', 'wav', 'webm', 'webp',
  'wmv', 'xls', 'xlsx', 'zip',
])

function isAllowedDownloadUrl(url: URL): boolean {
  return url.protocol === 'https:' || url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
}

export function isAllowedBrowserDownloadUrl(value: string): boolean {
  try { return isAllowedDownloadUrl(new URL(value.trim())) }
  catch { return false }
}

export function isMediaPlaylistUrl(value: string): boolean {
  try {
    const url = new URL(value.trim())
    return isAllowedDownloadUrl(url) && /\.(?:m3u8|mpd)$/i.test(url.pathname)
  } catch {
    return false
  }
}

export function isDirectDownloadUrl(value: string): boolean {
  try {
    const url = new URL(value.trim())
    if (!isAllowedDownloadUrl(url)) return false
    const pathname = url.pathname.toLowerCase()
    if (isMediaPlaylistUrl(url.href)) return false
    const extension = pathname.split('.').pop() || ''
    return directDownloadExtensions.has(extension)
  } catch {
    return false
  }
}

export async function startBrowserDownload(url: string): Promise<number | null> {
  if (!isDirectDownloadUrl(url)) return null
  if (!hasExtensionMessageRuntime()) return null
  const response = await sendExtensionMessage({ kind: 'browser.download', url: url.trim() }) as BrowserDownloadResponse
  if (!response?.ok) throw new Error(response?.error || 'Chrome 下载未能启动。')
  return response.downloadId
}

export async function getBrowserDownload(downloadId: number): Promise<BrowserDownloadInfo | null> {
  if (!hasExtensionMessageRuntime()) return null
  const response = await sendExtensionMessage({ kind: 'browser.download.get', downloadId }) as BrowserDownloadInfoResponse
  if (!response?.ok) throw new Error(response?.error || '无法读取 Chrome 下载状态。')
  return response.download ?? null
}

export async function listBrowserDownloads(): Promise<BrowserDownloadRecord[]> {
  if (!hasExtensionMessageRuntime()) return []
  const response = await sendExtensionMessage({ kind: 'browser.download.list' }) as BrowserDownloadListResponse
  if (!response?.ok) throw new Error(response?.error || '无法读取浏览器下载记录。')
  return response.downloads
}

export async function cancelBrowserDownload(downloadId: number): Promise<void> {
  if (!hasExtensionMessageRuntime()) return
  const response = await sendExtensionMessage({ kind: 'browser.download.cancel', downloadId }) as { ok: boolean; error?: string }
  if (!response?.ok) throw new Error(response?.error || 'Chrome 下载取消失败。')
}

export async function forgetBrowserDownload(downloadId: number): Promise<void> {
  if (!hasExtensionMessageRuntime()) return
  const response = await sendExtensionMessage({ kind: 'browser.download.forget', downloadId }) as { ok: boolean; error?: string }
  if (!response?.ok) throw new Error(response?.error || '浏览器下载记录删除失败。')
}

export async function openBrowserDownloads(): Promise<void> {
  if (!hasExtensionMessageRuntime()) return
  const response = await sendExtensionMessage({ kind: 'browser.download.show' }) as { ok: boolean; error?: string }
  if (!response?.ok) throw new Error(response?.error || '无法打开 Chrome 下载列表。')
}
