import { useCallback, useState } from 'react'

export function useDownloaderForm() {
  const [taskUrl, setTaskUrl] = useState('')
  const [addingTask, setAddingTask] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const clearSubmitError = useCallback(() => setSubmitError(''), [])
  return { taskUrl, setTaskUrl, addingTask, setAddingTask, submitError, setSubmitError, showAddForm, setShowAddForm, clearSubmitError }
}
