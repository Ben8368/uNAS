// Simplified DownloaderApp for v2 - AI features removed
import { useCallback, useMemo, useState } from 'react'

import { submitFetch } from 'unas-src/api'
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
import type { CookieBrowser } from 'unas-src/apps/downloader/types'
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
      const draft: FetchTaskDraft = {
        urls: urls,
        output_dir: 'browser-default-downloads',
        compatible_format: form.taskCompatibleFormat,
        max_concurrent: 1,
      }

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
    [
      form.taskCookieBrowser,
      form.taskCompatibleFormat,
      refreshLists,
      setOptimisticTasks,
      selection,
    ],
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

      const result = await runBatch(urls, (url) => submitTaskPayloads([url]))
      form.setTaskUrl(result.failed.map(({ item }) => item).join('\n'))
      if (result.failed.length) form.setSubmitError(describeBatch('提交模拟下载任务', result))
      else {
        actions.setActionError(describeBatch('提交模拟下载任务', result))
        form.setShowAddForm(false)
      }

    } catch (err: unknown) {
      form.setSubmitError(err instanceof Error ? err.message : '下载任务提交失败')
    } finally {
      form.setAddingTask(false)
    }
  }, [form, submitTaskPayloads, actions, refreshLists])

  const confirmCookieBrowserChange = useCallback(
    (browser: CookieBrowser) => {
      form.setTaskCookieBrowser('none')
      if (browser !== 'none') form.setSubmitError('当前 Demo 不读取浏览器登录态或 Cookie。请使用不带登录态的模拟任务。')

    },
    [form],
  )

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
              taskCookieBrowser={form.taskCookieBrowser}
              taskCompatibleFormat={form.taskCompatibleFormat}
              addingTask={form.addingTask}
              submitError={form.submitError}
              onTaskUrlChange={form.setTaskUrl}
              onTaskCookieBrowserChange={confirmCookieBrowserChange}
              onTaskCompatibleFormatChange={form.setTaskCompatibleFormat}
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
