import type { BrowserDownloadInfo } from 'unas-src/runtime/browserDownloads'
import type { DownloadTask } from './types'

export type DownloadObservation = { info: BrowserDownloadInfo | null; error?: never } | { error: string; info?: never }

/** Loss of observation is not proof that Chrome failed the transfer. */
export function applyDownloadObservation(task: DownloadTask, observation: DownloadObservation, failures = 0): DownloadTask {
  if (observation.error !== undefined) {
    return { ...task, status: failures >= 3 ? 'external' : task.status,
      stage: failures >= 3 ? '下载状态未知；请到 Chrome 下载页面查看，可移除此记录' : '状态查询失败，正在重试', error: observation.error }
  }
  const info = observation.info
  if (!info) return { ...task, status: 'external', stage: '下载记录已不可用；状态未知，可移除此记录', error: undefined }
  const status = info.state === 'complete' ? 'completed' : info.error === 'USER_CANCELED' ? 'cancelled' : info.state === 'interrupted' ? 'failed' : 'running'
  return { ...task, status,
    progress: status === 'completed' ? 100 : info.totalBytes > 0 ? Math.min(100, info.bytesReceived / info.totalBytes * 100) : task.progress,
    stage: status === 'completed' ? '浏览器下载完成' : status === 'cancelled' ? '浏览器下载已取消' : status === 'failed' ? '浏览器下载中断' : '浏览器下载中', error: info.error }
}

export function canRecheckDownload(task: DownloadTask): boolean {
  return task.executionSource === 'real' && task.status === 'external' &&
    task.params?.browser_download_tracked !== false && typeof task.params?.browser_download_id === 'number'
}
