import { useCallback, useState } from 'react'

import type { CookieBrowser } from 'unas-src/apps/downloader/types'

export function useDownloaderForm() {
  const [taskUrl, setTaskUrl] = useState('')
  const [taskOutputDir, setTaskOutputDir] = useState('')
  const [taskCookieBrowser, setTaskCookieBrowser] = useState<CookieBrowser>('none')
  // 仅记录模拟格式参数；不读取字幕或执行转码。
  const [taskCompatibleFormat, setTaskCompatibleFormat] = useState(false)
  const [addingTask, setAddingTask] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [directoryPickerOpen, setDirectoryPickerOpen] = useState(false)

  const clearSubmitError = useCallback(() => setSubmitError(''), [])

  return {
    taskUrl,
    setTaskUrl,
    taskOutputDir,
    setTaskOutputDir,
    taskCookieBrowser,
    setTaskCookieBrowser,
    taskCompatibleFormat,
    setTaskCompatibleFormat,
    addingTask,
    setAddingTask,
    submitError,
    setSubmitError,
    showAddForm,
    setShowAddForm,
    directoryPickerOpen,
    setDirectoryPickerOpen,
    clearSubmitError,
  }
}
