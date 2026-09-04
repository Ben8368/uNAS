import {
  ActionButton,
  BackIcon,
  ChevronSmallIcon,
  DownloadIcon,
  FileIcon,
  FolderIcon,
  FolderPlusIcon,
  ForwardIcon,
  GridIcon,
  IconButton,
  ListIcon,
  MoreIcon,
  RefreshIcon,
  SearchIcon,
  SortIcon,
  TrashIcon,
  TuneIcon,
  UploadIcon,
} from 'unas-src/apps/file-manager/controls'
import type { DiskInfo, FileEntry } from 'unas-src/apps/file-manager/types'
import { entryType, formatDate, formatSize, locationLabel } from 'unas-src/apps/file-manager/utils'

type FileManagerToolbarProps = {
  isTrashView: boolean
  canGoBack: boolean
  canGoForward: boolean
  currentPath: string
  currentParent: string | null
  searchText: string
  selectedCount: number
  trashCount: number
  onGoBack: () => void
  onGoForward: () => void
  onRefresh: () => void
  onGoParent: () => void
  onSearchChange: (value: string) => void
  onCreateFolder: () => void
  onDeleteSelected: () => void
  onRestoreSelected: () => void
  onPurgeSelected: () => void
  onEmptyTrash: () => void
  onUpload: () => void
  onDownloadSelected: () => void
}

export function FileManagerToolbar({
  isTrashView,
  canGoBack,
  canGoForward,
  currentPath,
  currentParent,
  searchText,
  selectedCount,
  trashCount,
  onGoBack,
  onGoForward,
  onRefresh,
  onGoParent,
  onSearchChange,
  onCreateFolder,
  onDeleteSelected,
  onRestoreSelected,
  onPurgeSelected,
  onEmptyTrash,
  onUpload,
  onDownloadSelected,
}: FileManagerToolbarProps) {
  return (
    <>
      <div className="fm-topbar">
        <div className="fm-nav-buttons">
          <IconButton disabled={!canGoBack} title="后退" onClick={onGoBack}><BackIcon /></IconButton>
          <IconButton disabled={!canGoForward} title="前进" onClick={onGoForward}><ForwardIcon /></IconButton>
          <IconButton disabled={!currentPath || isTrashView} title="刷新" onClick={onRefresh}><RefreshIcon /></IconButton>
        </div>
        <div className="fm-address">{isTrashView ? '回收站' : currentPath || '我的文件'}</div>
        <label className="fm-search">
          <SearchIcon />
          <input value={searchText} onChange={(event) => onSearchChange(event.target.value)} placeholder="搜索" />
        </label>
      </div>

      <div className="fm-actions">
        {isTrashView ? (
          <>
            <ActionButton icon={<DownloadIcon />} label="恢复" disabled={!selectedCount} onClick={onRestoreSelected} />
            <ActionButton icon={<TrashIcon />} label="彻底删除" disabled={!selectedCount} onClick={onPurgeSelected} />
            <ActionButton icon={<MoreIcon />} label="清空回收站" disabled={!trashCount} onClick={onEmptyTrash} />
          </>
        ) : (
          <>
            <ActionButton icon={<UploadIcon />} label="模拟选择文件" disabled={!currentPath} onClick={onUpload} />
            <ActionButton icon={<FolderPlusIcon />} label="新建文件夹" disabled={!currentPath} onClick={onCreateFolder} />
            <ActionButton icon={<DownloadIcon />} label="查看模拟结果" disabled={!selectedCount} onClick={onDownloadSelected} />
            <ActionButton icon={<TrashIcon />} label="移入回收站" disabled={!selectedCount} onClick={onDeleteSelected} />
            <ActionButton icon={<MoreIcon />} label="更多" disabled />
          </>
        )}
        <span className="fm-actions-spacer" />
        <IconButton disabled={!currentParent || isTrashView} title="上一级" onClick={onGoParent}><SortIcon /></IconButton>
        <IconButton title="当前为列表视图" disabled><ListIcon /></IconButton>
        <IconButton title="网格视图暂未提供" disabled><GridIcon /></IconButton>
      </div>
    </>
  )
}

type FileManagerEntryTableProps = {
  loading: boolean
  error: string
  isTrashView: boolean
  entries: FileEntry[]
  disks: DiskInfo[]
  selected: Set<string>
  onToggleSelect: (path: string) => void
  onOpenDirectory: (path: string) => void
}

export function FileManagerEntryTable({
  loading,
  error,
  isTrashView,
  entries,
  disks,
  selected,
  onToggleSelect,
  onOpenDirectory,
}: FileManagerEntryTableProps) {
  return (
    <section className="fm-table">
      <div className="fm-head">
        <span>文件名</span>
        <span>修改时间</span>
        <span>所在位置</span>
        <span>类型</span>
        <span><TuneIcon /></span>
      </div>

      <div className="fm-list">
        {loading && <div className="fm-empty">正在加载...</div>}
        {!loading && error && <div role="alert" className="fm-empty fm-empty--error">{error}</div>}
        {!loading && entries.map((entry) => (
          <div
            className={`fm-row ${selected.has(entry.path) ? 'fm-row--selected' : ''}`}
            key={entry.path}
            role="button"
            tabIndex={0}
            aria-pressed={selected.has(entry.path)}
            aria-label={`${entry.name}，${entry.type === 'directory' ? '文件夹' : '模拟文件'}`}
            onKeyDown={(event) => {
              if (event.key === ' ') { event.preventDefault(); onToggleSelect(entry.path) }
              if (event.key === 'Enter') {
                event.preventDefault()
                if (entry.type === 'directory') onOpenDirectory(entry.path)
                else onToggleSelect(entry.path)
              }
            }}
            onClick={() => onToggleSelect(entry.path)}
            onDoubleClick={() => entry.type === 'directory' && onOpenDirectory(entry.path)}
          >
            <div className="fm-name">
              <span className="fm-expander">{entry.type === 'directory' ? <ChevronSmallIcon /> : null}</span>
              {entry.type === 'directory' ? <FolderIcon /> : <FileIcon ext={entry.extension} />}
              <strong>{entry.name}</strong>
              {entry.type === 'file' && <small>{formatSize(entry.size)}</small>}
            </div>
            <span>{formatDate(entry.modified)}</span>
            <span>{isTrashView ? entry.original_path : locationLabel(entry.path, disks)}</span>
            <span>{entryType(entry)}</span>
            <span />
          </div>
        ))}
        {!loading && !error && entries.length === 0 && (
          <div className="fm-empty">{isTrashView ? '回收站为空' : '此目录为空'}</div>
        )}
      </div>
    </section>
  )
}
