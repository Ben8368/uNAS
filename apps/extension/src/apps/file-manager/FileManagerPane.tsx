import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { createFilebrowserDirectory, deleteFilebrowserPath, fetchAssets, uploadFilebrowserFile, subscribeDemo } from 'unas-src/api'
import type { AssetRecord, MockFileMetadata } from 'unas-src/api/types'
import { FileManagerEntryTable, FileManagerToolbar } from 'unas-src/apps/file-manager/FileManagerMainPanel'
import { FileManagerSidebar } from 'unas-src/apps/file-manager/FileManagerSidebar'
import type { DiskInfo } from 'unas-src/apps/file-manager/types'
import { isPathOnDisk, joinPath, parentPath, TRASH_PATH } from 'unas-src/apps/file-manager/utils'
import { useFilebrowserNavigator } from 'unas-src/apps/file-manager/useFilebrowserNavigator'
import { useFileManagerInit } from 'unas-src/apps/file-manager/useFileManagerInit'
import { useFileManagerTrash } from 'unas-src/apps/file-manager/useFileManagerTrash'
import { describeBatch, runBatch } from 'unas-src/application/batch'
import { getErrorMessage } from 'unas-src/utils'

export function FileManagerPane() {
  const {
    currentPath,
    directories,
    files,
    loading,
    error,
    setCurrentPath,
    setDirectories,
    setFiles,
    setError,
    navigate,
    invalidate,
    checkpoint,
    goBack,
    goForward,
    canGoBack,
    canGoForward,
  } = useFilebrowserNavigator()
  const [disks, setDisks] = useState<DiskInfo[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [searchText, setSearchText] = useState('')
  const [activeDiskPath, setActiveDiskPath] = useState('')
  const [lastLocalPath, setLastLocalPath] = useState('')
  const [assets, setAssets] = useState<AssetRecord[]>([])
  const [notice, setNotice] = useState('')
  const [busy, setBusyState] = useState(false)
  const busyRef = useRef(false)
  const setBusy = useCallback((value: boolean) => { busyRef.current = value; setBusyState(value) }, [])
  const [retryFixtures, setRetryFixtures] = useState<MockFileMetadata[]>([])

  const enterTrashView = useCallback(() => {
    invalidate()
    setCurrentPath(TRASH_PATH)
    setDirectories([])
    setFiles([])
    setSelected(new Set())
    setSearchText('')
    setError('')
  }, [invalidate, setCurrentPath, setDirectories, setError, setFiles])

  const trash = useFileManagerTrash({ currentPath, setError, enterTrashView })

  useFileManagerInit({
    navigate,
    checkpoint,
    setError,
    setDisks,
    setActiveDiskPath,
    setLastLocalPath,
  })

  const refreshAssets = useCallback(async () => {
    try {
      const result = await fetchAssets()
      setAssets(result.assets ?? [])
    } catch {
      setAssets([])
    }
  }, [])

  useEffect(() => {
    void refreshAssets()
  }, [refreshAssets])

  useEffect(() => subscribeDemo(() => {
    // Local batch handlers own their refresh/checkpoint and partial-failure notice.
    if (busyRef.current) return
    void refreshAssets()
    if (currentPath === TRASH_PATH) void trash.loadTrash()
    else if (currentPath) void navigate(currentPath, false)
  }), [currentPath, navigate, refreshAssets, trash.loadTrash])

  useEffect(() => {
    if (currentPath && currentPath !== TRASH_PATH) {
      setLastLocalPath(currentPath)
      trash.markLocalSection()
      setActiveDiskPath((current) => disks.find((disk) => isPathOnDisk(currentPath, disk.path))?.path || current)
    }
  }, [currentPath, disks, trash.markLocalSection])

  useEffect(() => {
    setSelected(new Set())
    setNotice('')
    setRetryFixtures([])
  }, [currentPath])

  const allEntries = useMemo(
    () => trash.isTrashView ? trash.trashEntries : [...directories, ...files],
    [directories, files, trash.isTrashView, trash.trashEntries],
  )

  useEffect(() => {
    const available = new Set(allEntries.map((entry) => entry.path))
    setSelected((items) => new Set([...items].filter((path) => available.has(path))))
  }, [allEntries])

  const filteredEntries = useMemo(() => {
    const keyword = searchText.trim().toLowerCase()
    if (!keyword) return allEntries
    return allEntries.filter((entry) => entry.name.toLowerCase().includes(keyword))
  }, [allEntries, searchText])

  const currentParent = parentPath(currentPath)

  function toggleSelect(path: string) {
    setSelected((items) => {
      const next = new Set(items)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  function openLocalFiles() {
    trash.markLocalSection()
    if (trash.isTrashView) {
      const targetPath = lastLocalPath || disks[0]?.path
      if (targetPath) void navigate(targetPath)
    }
  }

  async function createFolder() {
    if (!currentPath || trash.isTrashView) return
    const name = window.prompt('新建文件夹名称')
    if (!name?.trim()) return
    const stillHere = checkpoint()
    setBusy(true)
    try {
      await createFilebrowserDirectory(joinPath(currentPath, name.trim()))
      if (stillHere()) await navigate(currentPath, false)
    } catch (err: unknown) {
      if (stillHere()) setError(getErrorMessage(err) || '新建文件夹失败')
    } finally { setBusy(false) }
  }

  async function deleteSelected() {
    const paths = Array.from(selected).filter((path) => allEntries.some((entry) => entry.path === path))
    if (!paths.length || trash.isTrashView) return
    if (!window.confirm(`确定将选中的 ${paths.length} 项移入回收站吗？`)) return
    setBusy(true)
    const stillHere = checkpoint()
    const result = await runBatch(paths, (path) => deleteFilebrowserPath(path, true))
    if (stillHere()) {
      const refresh = navigate(currentPath, false)
      const ownsRefresh = checkpoint()
      await refresh
      if (ownsRefresh()) {
        setSelected(new Set(result.failed.map(({ item }) => item)))
        setNotice(describeBatch('模拟移入回收站', result))
      }
    }
    setBusy(false)
  }

  async function restoreSelected() {
    const ids = Array.from(selected)
    if (!ids.length) return
    setBusy(true)
    const stillHere = checkpoint()
    const result = await trash.restoreSelected(ids)
    if (result && stillHere()) {
      setSelected(new Set(result.failed.map(({ item }) => item)))
      setNotice(describeBatch('模拟恢复', result))
    }
    setBusy(false)
  }

  async function purgeSelected() {
    const ids = Array.from(selected)
    if (!ids.length) return
    setBusy(true)
    const stillHere = checkpoint()
    const result = await trash.purgeSelected(ids)
    if (result && stillHere()) {
      setSelected(new Set(result.failed.map(({ item }) => item)))
      setNotice(describeBatch('模拟彻底删除', result))
    }
    setBusy(false)
  }

  async function emptyTrash() {
    const stillHere = checkpoint()
    setBusy(true)
    try {
      await trash.emptyTrash()
      if (stillHere()) setSelected(new Set())
    } catch {
      // error already set in hook
    } finally { setBusy(false) }
  }

  async function handleUpload() {
    if (!currentPath || trash.isTrashView || busy) return
    const fixtures: MockFileMetadata[] = [
      { fixtureId: 'sample-image', executionSource: 'mock' },
      { fixtureId: 'sample-document', executionSource: 'mock' },
    ]
    setBusy(true)
    const stillHere = checkpoint()
    const result = await runBatch(retryFixtures.length ? retryFixtures : fixtures, (fixture) => uploadFilebrowserFile(currentPath, fixture))
    if (stillHere()) {
      const refresh = navigate(currentPath, false)
      const ownsRefresh = checkpoint()
      await refresh
      if (ownsRefresh()) {
        setRetryFixtures(result.failed.map(({ item }) => item))
        setNotice(`${describeBatch('添加内置模拟条目', result, (fixture) => fixture.fixtureId)}${result.failed.length ? ' 再次点击模拟选择文件，仅重试失败条目。' : ''}`)
      }
    }
    setBusy(false)
  }

  function downloadSelected() {
    const entries = allEntries.filter((entry) => selected.has(entry.path))
    setNotice(`模拟结果（executionSource: mock）：${entries.map((entry) => `${entry.name}，${entry.size ?? 0} 字节（固定演示元数据）`).join('；')}。未生成可下载文件。`)
  }

  return (
    <div className="fm-app">
      <FileManagerSidebar
        activeSection={trash.activeSection}
        disks={disks}
        assets={assets}
        activeDiskPath={activeDiskPath}
        currentPath={currentPath}
        onOpenLocal={openLocalFiles}
        onOpenTrash={trash.openTrash}
        onSelectDisk={(diskPath) => {
          const disk = disks.find((item) => item.path === diskPath)
          if (disk?.browsable === false) {
            setError('当前工作区未映射到此磁盘，仅展示容量信息。')
            return
          }
          setActiveDiskPath(diskPath)
          void navigate(diskPath)
        }}
      />

      <main className="fm-panel">
        <fieldset disabled={busy || loading} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <FileManagerToolbar
          isTrashView={trash.isTrashView}
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          currentPath={currentPath}
          currentParent={currentParent}
          searchText={searchText}
          selectedCount={selected.size}
          trashCount={trash.trashItems.length}
          onGoBack={goBack}
          onGoForward={goForward}
          onRefresh={() => currentPath && !trash.isTrashView && void navigate(currentPath, false)}
          onGoParent={() => currentParent && void navigate(currentParent)}
          onSearchChange={setSearchText}
          onCreateFolder={() => void createFolder()}
          onDeleteSelected={() => void deleteSelected()}
          onRestoreSelected={() => void restoreSelected()}
          onPurgeSelected={() => void purgeSelected()}
          onEmptyTrash={() => void emptyTrash()}
          onUpload={() => void handleUpload()}
          onDownloadSelected={downloadSelected}
        />
        </fieldset>
        {notice && <p role="status" style={{ padding: '0 16px', overflowWrap: 'anywhere' }}>{notice}</p>}

        <FileManagerEntryTable
          loading={loading}
          error={error}
          isTrashView={trash.isTrashView}
          entries={filteredEntries}
          disks={disks}
          selected={selected}
          onToggleSelect={toggleSelect}
          onOpenDirectory={(path) => void navigate(path)}
        />

        <footer className="fm-status">
          <span>模拟数据 · executionSource: mock · 共 {filteredEntries.length} 项</span>
          {selected.size > 0 && <span>已选 {selected.size} 项</span>}
        </footer>
      </main>
    </div>
  )
}
