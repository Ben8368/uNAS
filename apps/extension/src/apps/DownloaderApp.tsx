// Simplified DownloaderApp for v2 - AI features removed
import { useCallback, useMemo, useState } from 'react'

import { submitFetch } from 'unas-src/api'
import { hasExtensionMessageRuntime } from 'unas-src/runtime/extensionPlatform'
import { isDirectDownloadUrl, isMediaPlaylistUrl, startBrowserDownload } from 'unas-src/runtime/browserDownloads'
import { describeBatch, runBatch } from 'unas-src/application/batch'
import { DownloaderAddForm } from 'unas-src/apps/downloader/DownloaderAddForm'
import { DownloaderDetailDrawer } from 'unas-src/apps/downloader/DownloaderDetailDrawer'
import {
  createOptimisticTask,
  extractTaskDetailRows,
  extractTaskRequestSnapshot,
  mergeTasks,
} from 'unas-src/apps/downloader/helpers'
import { DownloaderSidebar } from 'unas-src/apps/downloader/DownloaderSidebar'
import { DownloaderStatusBar } from 'unas-src/apps/downloader/DownloaderStatusBar'
import { DownloaderTaskTable } from 'unas-src/apps/downloader/DownloaderTaskTable'
import { DownloaderToolbar } from 'unas-src/apps/downloader/DownloaderToolbar'
import { useDownloaderActions } from 'unas-src/apps/downloader/useDownloaderActions'
import { useDownloaderForm } from 'unas-src/apps/downloader/useDownloaderForm'
import { useDownloaderSelection } from 'unas-src/apps/downloader/useDownloaderSelection'
import { useDownloaderTaskData } from 'unas-src/apps/downloader/useDownloaderTaskData'
import type { FetchTaskDraft } from '#contracts'

export function DownloaderApp() {
  const { historyTasks, queueTasks, mergedTasks, pollError, refreshLists, setOptimisticTasks } = useDownloaderTaskData()

  const form = useDownloaderForm()
  const selection = useDownloaderSelection({ mergedTasks, historyTasks, queueTasks })
  const actions = useDownloaderActions({
    selectedTasks: selection.selectedTasks,
    selectedClearableTasks: selection.selectedClearableTasks,
    refreshLists,
    setOptimisticTasks,
    onOptimisticTaskCreated: (task) => selection.setSelectedTaskId(task.id),
  })

  // Submit task payloads (shared by single-URL and multi-URL paths)
  const submitTaskPayloads = useCallback(
    async (urls: string[]) => {
      const directUrls = urls.filter(isDirectDownloadUrl)
      if (urls.some(isMediaPlaylistUrl)) throw new Error('HLS/DASH 播放清单需要分片下载与媒体合并引擎，当前尚未接入。')
      if (hasExtensionMessageRuntime() && directUrls.length === urls.length && directUrls.length > 0) {
        for (const url of directUrls) {
          const downloadId = await startBrowserDownload(url)
          if (downloadId === null) throw new Error('此链接不是可直接交给 Chrome 的媒体文件 URL。m3u8/mpd 播放清单暂不下载。')
          const result = { ok: true, task_id: `browser-download-${downloadId}`, task_ids: [`browser-download-${downloadId}`], status: 'running' as const, executionSource: 'real' as const, browser_download_id: downloadId }
          const task = createOptimisticTask(url, { url, urls: [url], mode: 'video', output_dir: 'browser-default-downloads', route: 'browser', browser_download_id: downloadId }, result)
          setOptimisticTasks(prev => mergeTasks([task], prev))
          selection.setSelectedTaskId(task.id)
        }
        selection.clearSelection()
        selection.setSelectedCategory('all')
        return
      }

      if (directUrls.length > 0) throw new Error('本批链接需全部为可直接下载的文件，或全部作为演示链接提交；请勿混合。')
      const draft: FetchTaskDraft = { urls }
      const result = await submitFetch(draft)
      if (!result || !result.task_id) {
        throw new Error('任务创建失败：未返回任务 ID。')
      }

      const taskIds = result.task_ids?.length ? result.task_ids : [result.task_id]
      const optimisticTasks = taskIds.map((taskId, index) => {
        const url = urls[index] ?? urls[0] ?? ''
        return createOptimisticTask(url, { ...draft, url, urls: [url] }, { ...result, task_id: taskId })
      })
      setOptimisticTasks((prev) => mergeTasks(optimisticTasks, prev))
      selection.setSelectedTaskId(optimisticTasks[0]?.id ?? result.task_id)
      selection.clearSelection()
      selection.setSelectedCategory('all')
      void refreshLists().catch(() => {}) // The list hook retains its visible refresh error.
    },
    [refreshLists, setOptimisticTasks, selection],
  )

  const submitNewTask = useCallback(async () => {
    if (!form.taskUrl.trim() || form.addingTask) return
    form.setAddingTask(true)
    form.setSubmitError('')
    actions.setActionError('')
    try {
      const urls = form.taskUrl
        .split('\n')
        .map((url) => url.trim())
        .filter((url) => url.length > 0)

      const directUrls = urls.filter(isDirectDownloadUrl)
      if (directUrls.length > 0 && directUrls.length !== urls.length) {
        throw new Error('请勿在同一批次混合直链文件和网页链接。')
      }
      const result = await runBatch(urls, (url) => submitTaskPayloads([url]))
      form.setTaskUrl(result.failed.map(({ item }) => item).join('\n'))
      if (result.failed.length) form.setSubmitError(describeBatch('提交下载任务', result))
      else {
        actions.setActionError('')
        form.setShowAddForm(false)
      }

    } catch (err: unknown) {
      form.setSubmitError(err instanceof Error ? err.message : '下载任务提交失败')
    } finally {
      form.setAddingTask(false)
    }
  }, [form, submitTaskPayloads, actions, refreshLists])

  // Detail drawer derived data
  const detailRows = useMemo(() => (selection.selectedTask ? extractTaskDetailRows(selection.selectedTask) : []), [selection.selectedTask])
  const detailSnapshot = useMemo(() => {
    if (!selection.selectedTask) return ''
    const snapshot = extractTaskRequestSnapshot(selection.selectedTask)
    return typeof snapshot === 'string' ? snapshot : JSON.stringify(snapshot, null, 2)
  }, [selection.selectedTask])
  const detailState = useMemo(() => selection.selectedTask?.state ? JSON.stringify(selection.selectedTask.state, null, 2) : '', [selection.selectedTask?.state])
  const detailResult = useMemo(() => selection.selectedTask?.result ? JSON.stringify(selection.selectedTask.result, null, 2) : '', [selection.selectedTask?.result])

  const [detailOpen, setDetailOpen] = useState(false)

  return (
    <div className="dl-app">
      <DownloaderSidebar
        selectedCategory={selection.selectedCategory}
        stats={selection.stats}
        miniAiOpen={false}
        onToggleMiniAi={() => {}}
        onSelectCategory={(category) => {
          selection.setSelectedCategory(category)
          selection.clearSelection()
        }}
      />

      <main className={`dl-panel ${form.showAddForm ? 'dl-panel--with-form' : ''}`}>
        <DownloaderToolbar
          showAddForm={form.showAddForm}
          onToggleAddForm={() => form.setShowAddForm((prev) => !prev)}
          canStopSelected={selection.canStopSelected}
          onStopSelected={actions.stopSelected}
          canRetrySelected={selection.canRetrySelected}
          onRetrySelected={() => {
            actions.retrySelected().then((result) => {
              selection.setSelectedIds(new Set(result?.failed.map(({ item }) => item.id) ?? []))
              selection.setSelectedCategory('all')
            })
          }}
          canSelectAllVisible={selection.canSelectAllVisible}
          allVisibleSelected={selection.allVisibleSelected}
          onToggleSelectAll={selection.toggleSelectAllVisible}
          canClearRecords={selection.canClearRecords}
          clearRecordsTitle={selection.clearRecordsTitle}
          onClearRecords={() => {
            actions.clearRecords().then((result) => {
              selection.setSelectedIds(new Set(result?.failed.map(({ item }) => item.id) ?? []))
              selection.setSelectedTaskId(null)
            })
          }}
          searchText={selection.searchText}
          onSearchTextChange={selection.setSearchText}
        />

        <div className="dl-stage">
          {form.showAddForm && (
            <DownloaderAddForm
              taskUrl={form.taskUrl}
              addingTask={form.addingTask}
              submitError={form.submitError}
              onTaskUrlChange={form.setTaskUrl}
              onSubmit={submitNewTask}
              onClose={() => {
                form.setShowAddForm(false)
                form.clearSubmitError()
              }}
            />
          )}

          <DownloaderTaskTable
            filteredTasks={selection.filteredTasks}
            selectedTaskId={selection.selectedTaskId}
            selectedIds={selection.selectedIds}
            onRowClick={selection.handleRowClick}
            onRowMenuAction={actions.handleRowMenuAction}
          />

          {(actions.actionError || pollError) && (
            <div role="status" className="dl-action-error">{actions.actionError || pollError}</div>
          )}
        </div>

        <DownloaderStatusBar detailOpen={detailOpen} onToggleDetail={() => setDetailOpen((prev) => !prev)} />
      </main>

      <DownloaderDetailDrawer
        open={detailOpen}
        selectedTask={selection.selectedTask}
        detailRows={detailRows}
        detailRequest={detailSnapshot}
        detailState={detailState}
        detailResult={detailResult}
        actionError={actions.actionError}
        onClose={() => setDetailOpen(false)}
      />
    </div>
  )
}
