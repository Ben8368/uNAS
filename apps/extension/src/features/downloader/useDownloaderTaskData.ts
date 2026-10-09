import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { getActiveTasks, getWeeklyHistory, getDemoSnapshot, subscribeDemo } from 'unas-src/platform/workspace/api'
import { getBrowserDownload, listBrowserDownloads } from 'unas-src/platform/browser/browserDownloads'
import { abortableRequest } from 'unas-src/shared/jobs/pollJob'
import { applyDownloadObservation, canRecheckDownload, type DownloadObservation } from './browserDownloadState'
import { mergeTasks } from 'unas-src/features/downloader/helpers'
import type { DownloadTask } from 'unas-src/features/downloader/types'
import { useVisibilityPolling } from 'unas-src/shared/hooks/useVisibilityPolling'
import { getErrorMessage } from 'unas-src/shared/errors'

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
    const controller = new AbortController()
    void listBrowserDownloads().then(async records => {
      const restored = await Promise.all(records.map(async record => {
        const task: DownloadTask = {
          executionSource: 'real', id: `browser-download-${record.downloadId}`, type: 'download',
          name: record.url, source_url: record.url, status: 'running', progress: 0, stage: '正在读取浏览器下载状态',
          created_at: Math.floor(record.createdAt / 1000),
          params: { url: record.url, urls: [record.url], route: 'browser', browser_download_id: record.downloadId },
        }
        const observation = await observeDownload(record.downloadId, controller.signal)
        return applyDownloadObservation(task, observation)
      }))
      // Recovery is an older snapshot: preserve any state already observed/created in this page.
      if (!controller.signal.aborted) setOptimisticTasks(prev => mergeTasks(prev, restored))
    }).catch(() => {})
    return () => controller.abort()
  }, [])

  useVisibilityPolling(refreshLists, 2000)

  const browserDownloadKey = optimisticTasks
    .filter(task => task.executionSource === 'real' && task.params?.browser_download_tracked !== false &&
      (task.status === 'pending' || task.status === 'running') && typeof task.params?.browser_download_id === 'number')
    .map(task => task.params!.browser_download_id as number).sort((a, b) => a - b).join(',')
  const observationFailures = useRef(new Map<number, number>())
  useEffect(() => {
    if (!browserDownloadKey) { observationFailures.current.clear(); return }
    const ids = browserDownloadKey.split(',').map(Number)
    const failures = observationFailures.current
    for (const id of failures.keys()) if (!ids.includes(id)) failures.delete(id)
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const sync = async () => {
      const observations = await Promise.all(ids.map(async id => {
        const observation = await observeDownload(id, controller.signal)
        const count = observation.error !== undefined ? (failures.get(id) ?? 0) + 1 : 0
        if (!controller.signal.aborted) failures.set(id, count)
        return [id, observation, count] as const
      }))
      if (controller.signal.aborted) return
      setOptimisticTasks(prev => prev.map(task => {
        if (task.status !== 'running' && task.status !== 'pending') return task
        const observed = observations.find(([id]) => id === task.params?.browser_download_id)
        return observed ? applyDownloadObservation(task, observed[1], observed[2]) : task
      }))
      timer = setTimeout(() => { void sync() }, 2000)
    }
    void sync()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [browserDownloadKey, setOptimisticTasks])
  const recheckDownload = useCallback((task: DownloadTask) => {
    if (!canRecheckDownload(task)) return
    observationFailures.current.delete(task.params!.browser_download_id as number)
    setOptimisticTasks(prev => prev.map(current => current.id === task.id && canRecheckDownload(current)
      ? { ...current, status: 'pending', stage: '正在重新检查浏览器下载状态', error: undefined } : current))
  }, [])
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
    recheckDownload,
    setOptimisticTasks,
  }
}

async function observeDownload(id: number, signal: AbortSignal): Promise<DownloadObservation> {
  try { return { info: await abortableRequest(() => getBrowserDownload(id), signal, 10_000) } }
  catch (error) { return { error: getErrorMessage(error) || '无法读取 Chrome 下载状态。' } }
}
