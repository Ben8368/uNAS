import { useCallback, useState } from 'react'

import type { CookieBrowser } from 'unas-src/apps/downloader/types'

export function useDownloaderForm() {
  const [taskUrl, setTaskUrl] = useState('')
  const [taskCookieBrowser, setTaskCookieBrowser] = useState<CookieBrowser>('none')
  const [taskCompatibleFormat, setTaskCompatibleFormat] = useState(false)
  const [addingTask, setAddingTask] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const clearSubmitError = useCallback(() => setSubmitError(''), [])
  return { taskUrl, setTaskUrl, taskCookieBrowser, setTaskCookieBrowser, taskCompatibleFormat, setTaskCompatibleFormat, addingTask, setAddingTask, submitError, setSubmitError, showAddForm, setShowAddForm, clearSubmitError }
}
