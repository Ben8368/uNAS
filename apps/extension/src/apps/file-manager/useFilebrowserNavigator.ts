import { useCallback, useEffect, useRef, useState } from 'react'

import { listFilebrowserDirectory } from 'unas-src/api'
import type { FileEntry, ListResponse } from './types'
import { LatestRequest } from './latestRequest'
import { getErrorMessage } from 'unas-src/utils'

export function useFilebrowserNavigator() {
  const [currentPath, setCurrentPath] = useState('')
  const [directories, setDirectories] = useState<FileEntry[]>([])
  const [files, setFiles] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState({ paths: [] as string[], index: -1 })
  const requests = useRef(new LatestRequest())
  useEffect(() => () => requests.current.invalidate(), [])

  const invalidate = useCallback(() => {
    requests.current.invalidate()
    setLoading(false)
  }, [])
  const checkpoint = useCallback(() => requests.current.checkpoint(), [])

  const navigate = useCallback(async (path: string, push = true, historyTarget?: number) => {
    if (!path) return null
    const request = requests.current.begin()
    setLoading(true)
    setError('')
    try {
      const data = await listFilebrowserDirectory({ directory: path }, request.signal) as ListResponse
      if (!request.isCurrent()) return null
      if (!data.ok) throw new Error('目录加载失败')
      setCurrentPath(data.path)
      setDirectories(data.directories || [])
      setFiles(data.files || [])
      if (push) {
        setHistory(({ paths, index }) => ({ paths: [...paths.slice(0, index + 1), data.path], index: index + 1 }))
      } else if (historyTarget !== undefined) {
        setHistory((state) => ({ ...state, index: historyTarget }))
      }
      return data
    } catch (err: unknown) {
      if (request.isCurrent()) setError(getErrorMessage(err) || '目录加载失败')
      return null
    } finally {
      if (request.isCurrent()) setLoading(false)
    }
  }, [])

  const resetHistory = useCallback(() => {
    invalidate()
    setHistory({ paths: [], index: -1 })
  }, [invalidate])
  const goBack = useCallback(() => {
    if (history.index > 0) void navigate(history.paths[history.index - 1], false, history.index - 1)
  }, [history, navigate])
  const goForward = useCallback(() => {
    if (history.index < history.paths.length - 1) void navigate(history.paths[history.index + 1], false, history.index + 1)
  }, [history, navigate])

  return {
    currentPath, directories, files, loading, error, setError,
    setCurrentPath, setDirectories, setFiles, navigate, resetHistory,
    invalidate, checkpoint, goBack, goForward,
    canGoBack: history.index > 0,
    canGoForward: history.index >= 0 && history.index < history.paths.length - 1,
  }
}
