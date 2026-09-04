import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  emptyFilebrowserTrash,
  fetchFilebrowserTrash,
  purgeFilebrowserTrash,
  restoreFilebrowserTrash,
} from 'unas-src/api'
import type { FileEntry, TrashEntry } from 'unas-src/apps/file-manager/types'
import { TRASH_PATH } from 'unas-src/apps/file-manager/utils'
import { LatestRequest } from './latestRequest'
import { runBatch } from 'unas-src/application/batch'
import { getErrorMessage } from 'unas-src/utils'

type UseFileManagerTrashOpts = {
  currentPath: string
  setError: (message: string) => void
  enterTrashView: () => void
}

export function useFileManagerTrash({ currentPath, setError, enterTrashView }: UseFileManagerTrashOpts) {
  const [activeSection, setActiveSection] = useState<'local' | 'trash'>('local')
  const [trashItems, setTrashItems] = useState<TrashEntry[]>([])
  const requests = useRef(new LatestRequest())
  useEffect(() => () => requests.current.invalidate(), [])

  const isTrashView = currentPath === TRASH_PATH

  const trashEntries = useMemo<FileEntry[]>(() => trashItems.map((item) => ({
    name: item.name,
    path: item.id,
    size: item.size,
    modified: new Date(item.deleted_at * 1000).toISOString().slice(0, 19).replace('T', ' '),
    type: item.type,
    original_path: item.original_path,
  })), [trashItems])

  const loadTrash = useCallback(async () => {
    const request = requests.current.begin()
    setError('')
    try {
      const data = await fetchFilebrowserTrash()
      if (request.isCurrent()) setTrashItems(data?.items || [])
    } catch (err: unknown) {
      if (request.isCurrent()) setError(getErrorMessage(err) || '回收站加载失败')
    }
  }, [setError])

  const openTrash = useCallback(() => {
    setActiveSection('trash')
    enterTrashView()
    void loadTrash()
  }, [enterTrashView, loadTrash])

  const markLocalSection = useCallback(() => {
    requests.current.invalidate()
    setActiveSection('local')
  }, [])

  const restoreSelected = useCallback(async (ids: string[]) => {
    if (!ids.length || !isTrashView) return
    const isCurrent = requests.current.checkpoint()
    const result = await runBatch(ids, restoreFilebrowserTrash)
    if (isCurrent()) await loadTrash()
    return result
  }, [isTrashView, loadTrash])

  const purgeSelected = useCallback(async (ids: string[]) => {
    if (!ids.length || !isTrashView) return
    if (!window.confirm(`确定彻底删除选中的 ${ids.length} 个模拟条目吗？`)) return
    const isCurrent = requests.current.checkpoint()
    const result = await runBatch(ids, purgeFilebrowserTrash)
    if (isCurrent()) await loadTrash()
    return result
  }, [isTrashView, loadTrash])

  const emptyTrash = useCallback(async () => {
    if (!isTrashView || trashItems.length === 0) return
    if (!window.confirm('确定清空回收站吗？此操作不可恢复。')) return
    const isCurrent = requests.current.checkpoint()
    try {
      await emptyFilebrowserTrash()
      if (isCurrent()) await loadTrash()
    } catch (err: unknown) {
      if (isCurrent()) setError(getErrorMessage(err) || '清空回收站失败')
      throw err
    }
  }, [isTrashView, loadTrash, setError, trashItems.length])

  return {
    activeSection,
    trashItems,
    trashEntries,
    isTrashView,
    loadTrash,
    openTrash,
    markLocalSection,
    restoreSelected,
    purgeSelected,
    emptyTrash,
  }
}
