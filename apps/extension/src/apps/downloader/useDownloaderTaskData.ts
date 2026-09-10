import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { getActiveTasks, getWeeklyHistory, getDemoSnapshot, subscribeDemo } from 'unas-src/api'
import { getBrowserDownload, listBrowserDownloads } from 'unas-src/runtime/browserDownloads'
import { mergeTasks } from 'unas-src/apps/downloader/helpers'
import type { DownloadTask } from 'unas-src/apps/downloader/types'
import { useVisibilityPolling } from 'unas-src/hooks/useVisibilityPolling'
import { getErrorMessage } from 'unas-src/utils'

type ApiTask = {
  executionSource?: 'mock' | 'real'
  id?: string
  task_id?: string
  title?: string
  source_url?: string
  status?: DownloadTask['status']
  progress?: number
  stage?: string
  created_at?: number
  updated_at?: number | null
  started_at?: number | null
  completed_at?: number | null
  params?: Record<string, unknown>
  result?: Record<string, unknown>
  output_files?: string[]
  error?: string | null
}

function mapApiTaskToDownloadTask(task: ApiTask): DownloadTask {
  const id = task.id || task.task_id || ''
  const title = task.title || task.source_url || 'Untitled'
  const outputFiles = Array.isArray(task.output_files) ? task.output_files : []
  return {
    executionSource: task.executionSource === 'real' ? 'real' : 'mock',
    id,
    name: title,
    title: task.title || '',
    source_url: task.source_url || '',
    type: 'download',
    status: task.status || 'pending',
    progress: normalizeProgress(task.progress),
    stage: task.stage || 'queued',
    created_at: typeof task.created_at === 'number' ? task.created_at : 0,
    updated_at: typeof task.updated_at === 'number' ? task.updated_at : null,
    started_at: typeof task.started_at === 'number' ? task.started_at : null,
    completed_at: typeof task.completed_at === 'number' ? task.completed_at : null,
    params: task.params || {},
    result: task.result && Object.keys(task.result).length > 0 ? task.result : outputFiles.length > 0 ? { files: outputFiles } : undefined,
    output_files: outputFiles,
    error: task.error || undefined,
  }
}

function normalizeTaskList(response: unknown): ApiTask[] {
  if (Array.isArray(response)) return response as ApiTask[]
  if (response && typeof response === 'object' && Array.isArray((response as { tasks?: unknown }).tasks)) {
    return (response as { tasks: ApiTask[] }).tasks
  }
  return []
}

function normalizeProgress(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return value <= 1 ? value * 100 : value
}

export function useDownloaderTaskData() {
  const [{ tasks, historyTasks }, setLists] = useState(() => {
    // The mock port already has a current snapshot; do not paint an invented empty state.
    const historyTasks = getDemoSnapshot().tasks.map(mapApiTaskToDownloadTask)
      .sort((a, b) => b.created_at - a.created_at)
    return { tasks: historyTasks.filter(task => !['completed', 'failed', 'cancelled'].includes(task.status)), historyTasks }
  })
  const [optimisticTasks, setOptimisticTasks] = useState<DownloadTask[]>([])
  const [pollError, setPollError] = useState('')
  const taskRequestGenerationRef = useRef(0)
  const refreshLists = useCallback(async (signal?: AbortSignal) => {
    const generation = ++taskRequestGenerationRef.current
    try {
      const [activeRes, historyRes] = await Promise.all([getActiveTasks(signal), getWeeklyHistory(signal)])
      if (signal?.aborted || generation !== taskRequestGenerationRef.current) return
      const mappedTasks = normalizeTaskList(activeRes).map(mapApiTaskToDownloadTask)
      const mappedHistory = normalizeTaskList(historyRes).map(mapApiTaskToDownloadTask)
      mappedTasks.sort((a, b) => b.created_at - a.created_at)
      mappedHistory.sort((a, b) => b.created_at - a.created_at)
      // Publish both lists together so terminal tasks cannot reappear from an old history snapshot.
      setLists({ tasks: mappedTasks, historyTasks: mappedHistory })
      setPollError('')
    } catch (err: unknown) {
      if (signal?.aborted || generation !== taskRequestGenerationRef.current) return
      setPollError(getErrorMessage(err) || '任务列表刷新失败')
      throw err
    }
  }, [])

  useEffect(() => {
    let stopped = false
    void listBrowserDownloads().then(async records => {
      const tasks = await Promise.all(records.map(async record => {
        const info = await getBrowserDownload(record.downloadId).catch(() => null)
        if (!info) return null
        const status = info.state === 'complete' ? 'completed' : info.error === 'USER_CANCELED' ? 'cancelled' : info.state === 'interrupted' ? 'failed' : 'running'
        return {
          executionSource: 'real' as const,
          id: `browser-download-${record.downloadId}`,
          type: 'download',
          name: record.url,
          source_url: record.url,
          status,
          progress: info.totalBytes > 0 ? Math.min(100, info.bytesReceived / info.totalBytes * 100) : status === 'completed' ? 100 : 0,
          stage: status === 'completed' ? '浏览器下载完成' : status === 'cancelled' ? '浏览器下载已取消' : status === 'failed' ? '浏览器下载中断' : '浏览器下载中',
          created_at: Math.floor(record.createdAt / 1000),
          params: { url: record.url, urls: [record.url], route: 'browser', browser_download_id: record.downloadId },
          error: info.error,
        } satisfies DownloadTask
      }))
      const restored = tasks.filter((task): task is NonNullable<typeof task> => task !== null)
      if (!stopped) setOptimisticTasks(prev => mergeTasks(restored, prev))
    }).catch(() => {})
    return () => { stopped = true }
  }, [])

  useVisibilityPolling(refreshLists, 2000)

  // Chrome owns the actual transfer for real browser-download tasks. Poll only
  // the small status record here; bytes never enter the extension workspace.
  const browserDownloadIds = useMemo(() => optimisticTasks
    .map(task => task.executionSource === 'real' && typeof task.params?.browser_download_id === 'number' ? task.params.browser_download_id : null)
    .filter((id): id is number => id !== null)
    .sort((a, b) => a - b), [optimisticTasks])
  useEffect(() => {
    if (browserDownloadIds.length === 0) return
    let stopped = false
    const sync = async () => {
      const statuses = await Promise.all(browserDownloadIds.map(async id => [id, await getBrowserDownload(id).catch(() => null)] as const))
      if (stopped) return
      setOptimisticTasks(prev => prev.map(task => {
        const id = task.params?.browser_download_id
        if (typeof id !== 'number') return task
        const info = statuses.find(([downloadId]) => downloadId === id)?.[1]
        if (!info) return task
        const progress = info.totalBytes > 0 ? Math.min(100, info.bytesReceived / info.totalBytes * 100) : task.progress
        const status = info.state === 'complete' ? 'completed' : info.error === 'USER_CANCELED' ? 'cancelled' : info.state === 'interrupted' ? 'failed' : 'running'
        return { ...task, status, progress, stage: status === 'completed' ? '浏览器下载完成' : status === 'cancelled' ? '浏览器下载已取消' : status === 'failed' ? '浏览器下载中断' : '浏览器下载中', error: info.error }
      }))
    }
    void sync()
    const timer = window.setInterval(() => { void sync() }, 2000)
    return () => { stopped = true; window.clearInterval(timer) }
  }, [browserDownloadIds, setOptimisticTasks])
  useEffect(() => {
    const unsubscribe = subscribeDemo(() => { void refreshLists().catch(() => {}) })
    return () => { unsubscribe(); taskRequestGenerationRef.current++ }
  }, [refreshLists])

  useEffect(() => {
    setOptimisticTasks((prev) =>
      prev.filter(
        (task) => task.executionSource === 'real' || (!tasks.some((activeTask) => activeTask.id === task.id) && !historyTasks.some((historyTask) => historyTask.id === task.id)),
      ),
    )
  }, [historyTasks, tasks])

  const queueTasks = useMemo(() => mergeTasks(optimisticTasks, tasks), [optimisticTasks, tasks])
  /** history 需在合并时覆盖 queue：避免乐观任务或旧 active 占位（无 result）盖住历史里的完整落盘字段 */
  const mergedTasks = useMemo(() => mergeTasks(historyTasks, queueTasks), [historyTasks, queueTasks])

  return {
    tasks,
    historyTasks,
    queueTasks,
    mergedTasks,
    pollError,
    refreshLists,
    setOptimisticTasks,
  }
}
