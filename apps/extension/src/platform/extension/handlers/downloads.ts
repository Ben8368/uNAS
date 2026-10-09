import { extensionApi, getExtensionLocalValue, setExtensionLocalValue } from '../extensionPlatform'
import { isDirectDownloadUrl } from '../../browser/browserDownloads'
import { defineRoute, type RuntimeResponse } from '../routes'
import { isExtensionPage } from '../sender-policy'

const BROWSER_DOWNLOAD_STORAGE_KEY = 'unas-browser-downloads-v1'
const MAX_BROWSER_DOWNLOAD_RECORDS = 200

type BrowserDownloadRecord = { downloadId: number; url: string; createdAt: number }
type BrowserDownloadMessage =
  | { kind: 'browser.download'; url: string }
  | { kind: 'browser.download.get'; downloadId: number }
  | { kind: 'browser.download.cancel'; downloadId: number }
  | { kind: 'browser.download.forget'; downloadId: number }
  | { kind: 'browser.download.list' }
  | { kind: 'browser.download.show' }
  | { kind: 'browser.downloads.files.list' }
  | { kind: 'browser.downloads.files.show'; downloadId: number }

let browserDownloadMutationTail = Promise.resolve()

function enqueueBrowserDownloadMutation<T>(operation: () => Promise<T>) {
  const result = browserDownloadMutationTail.then(operation, operation)
  browserDownloadMutationTail = result.then(() => undefined, () => undefined)
  return result
}

function isBrowserDownloadRecord(value: unknown): value is BrowserDownloadRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return typeof record.downloadId === 'number' && Number.isSafeInteger(record.downloadId) && record.downloadId >= 0 &&
    typeof record.url === 'string' && record.url.length <= 4096 && typeof record.createdAt === 'number' && Number.isFinite(record.createdAt)
}

async function readBrowserDownloadRecords(): Promise<BrowserDownloadRecord[]> {
  const stored = await getExtensionLocalValue(BROWSER_DOWNLOAD_STORAGE_KEY)
  return Array.isArray(stored) ? stored.filter(isBrowserDownloadRecord).slice(-MAX_BROWSER_DOWNLOAD_RECORDS) : []
}

function isBrowserDownloadMessage(message: unknown): message is BrowserDownloadMessage {
  if (!message || typeof message !== 'object' || Array.isArray(message)) return false
  const value = message as Record<string, unknown>
  if (value.kind === 'browser.download') {
    if (typeof value.url !== 'string' || value.url.length > 4096) return false
    return isDirectDownloadUrl(value.url)
  }
  if (value.kind === 'browser.download.list' || value.kind === 'browser.download.show' || value.kind === 'browser.downloads.files.list') return true
  if (value.kind === 'browser.downloads.files.show') return Number.isSafeInteger(value.downloadId) && Number(value.downloadId) >= 0
  return (value.kind === 'browser.download.get' || value.kind === 'browser.download.cancel' || value.kind === 'browser.download.forget') && Number.isInteger(value.downloadId) && Number(value.downloadId) >= 0
}

async function handleBrowserDownload(message: BrowserDownloadMessage): Promise<RuntimeResponse> {
  const downloads = extensionApi()?.downloads
  if (!downloads) return { ok: false, error: 'Chrome downloads API 不可用；请确认扩展已重新加载并启用下载功能。' }
  try {
    if (message.kind === 'browser.download') {
      return await enqueueBrowserDownloadMutation(async () => {
        const url = message.url.trim()
        // Fail before the external side effect when local tracking is already unavailable.
        const records = await readBrowserDownloadRecords()
        const downloadId = await downloads.download({ url, conflictAction: 'uniquify', saveAs: false })
        try {
          await setExtensionLocalValue(BROWSER_DOWNLOAD_STORAGE_KEY, [...records, { downloadId, url, createdAt: Date.now() }].slice(-MAX_BROWSER_DOWNLOAD_RECORDS))
        } catch {
          // Chrome has already accepted the download. Report its real ID instead
          // of inviting a retry that could create a duplicate transfer.
          return {
            ok: true,
            downloadId,
            trackingWarning: `Chrome 已启动下载（ID ${downloadId}），但 uNAS 未能保存记录。请到 Chrome 下载页面查看进度或取消；关闭此下载窗口后，uNAS 无法恢复该任务。`,
          }
        }
        return { ok: true, downloadId }
      })
    }
    if (message.kind === 'browser.download.list') {
      return await enqueueBrowserDownloadMutation(async () => ({ ok: true, downloads: await readBrowserDownloadRecords() }))
    }
    if (message.kind === 'browser.download.show') {
      const tabs = extensionApi()?.tabs
      if (!tabs) throw new Error('Chrome 标签页 API 不可用；无法打开下载列表。')
      await tabs.create({ url: 'chrome://downloads/', active: true })
      return { ok: true }
    }
    if (message.kind === 'browser.downloads.files.list') {
      const items = await downloads.search({ limit: 200, orderBy: ['-startTime'] })
      return { ok: true, items: items.map(item => ({
        id: item.id,
        name: (item.filename || '').split(/[\\/]/).filter(Boolean).at(-1) || '未命名文件',
        state: item.state,
        bytesReceived: item.bytesReceived,
        totalBytes: item.totalBytes,
        exists: item.exists,
        startTime: item.startTime,
      })) }
    }
    if (message.kind === 'browser.downloads.files.show') {
      if (!downloads.show) throw new Error('当前浏览器不支持在文件夹中显示下载文件。')
      await downloads.show(message.downloadId)
      return { ok: true }
    }
    return await enqueueBrowserDownloadMutation(async () => {
      const records = await readBrowserDownloadRecords()
      const owned = records.some((record) => record.downloadId === message.downloadId)
      if (!owned) {
        if (message.kind === 'browser.download.get') return { ok: true, download: undefined }
        if (message.kind === 'browser.download.forget') return { ok: true }
        return { ok: false, error: '此下载不属于 uNAS，未执行操作。' }
      }
      if (message.kind === 'browser.download.cancel') {
        await downloads.cancel(message.downloadId)
        return { ok: true }
      }
      if (message.kind === 'browser.download.forget') {
        await setExtensionLocalValue(BROWSER_DOWNLOAD_STORAGE_KEY, records.filter((record) => record.downloadId !== message.downloadId))
        return { ok: true }
      }
      const [download] = await downloads.search({ id: message.downloadId })
      if (!download) return { ok: true, download: undefined }
      return { ok: true, download: { id: download.id, state: download.state, bytesReceived: download.bytesReceived, totalBytes: download.totalBytes, error: download.error } }
    })
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Chrome 下载操作失败。' }
  }
}

/** No `rejection`: an unauthorized download message falls through to the generic invalid-source answer. */
export const downloadRoute = defineRoute({
  matches: isBrowserDownloadMessage,
  authorize: isExtensionPage,
  handle: message => handleBrowserDownload(message),
})
