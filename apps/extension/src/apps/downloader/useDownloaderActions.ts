import { useCallback, useState } from 'react'

import { cancelTask, deleteTaskRecord, submitFetch } from 'unas-src/api'
import {
  buildRetryPayload,
  createOptimisticTask,
  getTaskSourceUrl,
  mergeTasks,
} from 'unas-src/apps/downloader/helpers'
import { describeBatch, runBatch } from 'unas-src/application/batch'
import type { DownloadTask, DownloaderRowMenuAction } from 'unas-src/apps/downloader/types'

interface UseDownloaderActionsOpts {
  selectedTasks: DownloadTask[]
  selectedClearableTasks: DownloadTask[]
  refreshLists: () => Promise<void>
  setOptimisticTasks: React.Dispatch<React.SetStateAction<DownloadTask[]>>
  onOptimisticTaskCreated?: (task: DownloadTask) => void
}

type SubmitFetchResult = Awaited<ReturnType<typeof submitFetch>>

function createCheckedOptimisticTask(urls: string[], payload: Record<string, unknown>, result: SubmitFetchResult): DownloadTask {
  if (!result || !result.task_id) {
    throw new Error('任务创建失败：未返回任务 ID。')
  }
  return createOptimisticTask(urls.join(', '), payload, result)
}

export function useDownloaderActions({
  selectedTasks,
  selectedClearableTasks,
  refreshLists,
  setOptimisticTasks,
  onOptimisticTaskCreated,
}: UseDownloaderActionsOpts) {
  const [actionError, setActionError] = useState('')

  const clearRecords = useCallback(async () => {
    if (!selectedClearableTasks.length) return
    setActionError('')
    const result = await runBatch(selectedClearableTasks, (task) => deleteTaskRecord(task.id))
    try { await refreshLists() } catch (error) {
      setActionError(`${describeBatch('清除模拟记录', result, (task) => task.id)} 刷新失败，请刷新列表。`)
      return result
    }
    setActionError(describeBatch('清除模拟记录', result, (task) => task.id))
    return result
  }, [refreshLists, selectedClearableTasks])

  const stopSelected = useCallback(async () => {
    if (!selectedTasks.length) return
    setActionError('')
    const result = await runBatch(selectedTasks, (task) => cancelTask(task.id))
    try { await refreshLists() } catch {
      setActionError(`${describeBatch('发送取消请求', result, (task) => task.id)} 刷新失败；终态尚未确认。`)
      return
    }
    setActionError(`${describeBatch('发送取消请求', result, (task) => task.id)} 以列表中的任务终态为准。`)
  }, [refreshLists, selectedTasks])

  const retrySelected = useCallback(async () => {
    if (!selectedTasks.length) return
    setActionError('')
    const result = await runBatch(selectedTasks, async (task) => {
      const payload = buildRetryPayload(task)
      if (!payload) throw new Error('缺少可重试的 URL')
      const urls = Array.isArray(payload.urls) ? payload.urls.filter((url): url is string => typeof url === 'string') : []
      if (!urls.length) throw new Error('缺少可重试的 URL')
      const created = await submitFetch(payload)
      const optimisticTask = createCheckedOptimisticTask(urls, payload, created)
      setOptimisticTasks((prev) => mergeTasks([optimisticTask], prev))
      onOptimisticTaskCreated?.(optimisticTask)
    })
    try { await refreshLists() } catch {
      setActionError(`${describeBatch('重试模拟任务', result, (task) => task.id)} 刷新失败，请刷新列表。`)
      return result
    }
    setActionError(describeBatch('重试模拟任务', result, (task) => task.id))
    return result
  }, [onOptimisticTaskCreated, refreshLists, selectedTasks, setOptimisticTasks])

  const handleRowMenuAction = useCallback(
    async (action: DownloaderRowMenuAction, task: DownloadTask) => {
      setActionError('')
      if (action === 'copy_url') {
        const url = getTaskSourceUrl(task)
        if (!url) {
          setActionError('此任务缺少来源链接')
          return
        }
        try { await navigator.clipboard.writeText(url) } catch { setActionError('无法复制链接，请手动选择并复制来源 URL。') }
      }
      if (action === 'download_file') {
        setActionError(`模拟结果 ${task.id}（executionSource: mock）：不包含可下载文件。`)
      }
      if (action === 'retry') {
        const payload = buildRetryPayload(task)
        if (!payload) {
          setActionError('此任务缺少可重试的 URL')
          return
        }
        try {
          const result = await submitFetch(payload)
          const urls = Array.isArray(payload.urls) ? payload.urls.filter((url): url is string => typeof url === 'string') : []
          const optimisticTask = createCheckedOptimisticTask(urls, payload, result)
          setOptimisticTasks((prev) => mergeTasks([optimisticTask], prev))
          onOptimisticTaskCreated?.(optimisticTask)
          await refreshLists()
        } catch (err: unknown) {
          setActionError(err instanceof Error ? err.message : '重试任务失败')
        }
      }
    },
    [onOptimisticTaskCreated, refreshLists, setOptimisticTasks],
  )

  return {
    actionError,
    setActionError,
    clearRecords,
    stopSelected,
    retrySelected,
    handleRowMenuAction,
  }
}
