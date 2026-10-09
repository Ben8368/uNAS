import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, FolderOpen, Home, ShieldCheck, Search, X, ChevronRight } from 'lucide-react'

import { fileWorkspacePort } from 'unas-src/platform/filesystem/fileWorkspace'
import type { AuthorizedDirectoryListing, FileRef } from '#contracts'
import { BackIcon, DocumentPlusIcon, ExtractIcon, FileIcon, FolderIcon, FolderPlusIcon, RefreshIcon, TrashIcon } from 'unas-src/features/file-manager/controls'
import { formatDate, formatSize } from 'unas-src/features/file-manager/utils'
import { getErrorMessage } from 'unas-src/shared/errors'
import { directoryEntries, type DirectorySort } from './directoryView'
import { FilePreviewPanel } from './FilePreviewPanel'
import { createPreviewReader } from './previewRead'
import { LocalMediaPlayer } from 'unas-src/features/file-manager/real/media/LocalMediaPlayer'

const MEDIA_EXTENSIONS = new Set(['mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg', 'opus', 'mp4', 'm4v', 'mov', 'webm', 'mkv', 'ogv'])
function mediaExtension(name: string) { return name.slice(name.lastIndexOf('.') + 1).toLowerCase() }
async function hasMediaSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  const ascii = (start: number, value: string) => value.split('').every((char, index) => bytes[start + index] === char.charCodeAt(0))
  if (ascii(0, 'ID3') || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) return true
  if (ascii(0, 'fLaC') || ascii(0, 'OggS') || ascii(0, 'RIFF') && ascii(8, 'WAVE')) return true
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return true
  return ascii(4, 'ftyp')
}

export function LocalDirectoryPane({ active = true }: { active?: boolean }) {
  const [access, setAccess] = useState(fileWorkspacePort.getSnapshot)
  const [listing, setListing] = useState<AuthorizedDirectoryListing | null>(null)
  const [loading, setLoading] = useState(false)
  const [writing, setWriting] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [preview, setPreview] = useState<FileRef>()
  const [mediaFiles, setMediaFiles] = useState<File[]>()
  const [mediaIndex, setMediaIndex] = useState(0)
  const [openingMedia, setOpeningMedia] = useState(false)
  const [history, setHistory] = useState<string[]>(['/'])
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<DirectorySort>('name')
  const request = useRef(0)
  const previousGrant = useRef(access.grantId)
  const extractionInFlight = useRef(false)
  const mounted = useRef(true)
  const previewReader = useMemo(() => createPreviewReader('handle', fileWorkspacePort.fileMetadata, fileWorkspacePort.openFileRead), [])

  useEffect(() => {
    mounted.current = true
    const cancelExtraction = () => {
      if (extractionInFlight.current) fileWorkspacePort.cancelZipExtraction()
    }
    window.addEventListener('pagehide', cancelExtraction)
    return () => {
      mounted.current = false
      window.removeEventListener('pagehide', cancelExtraction)
      cancelExtraction()
    }
  }, [])

  useEffect(() => fileWorkspacePort.subscribe(() => {
    const next = fileWorkspacePort.getSnapshot()
    request.current += 1
    if (next.grantId !== previousGrant.current || next.status !== 'ready') {
      previousGrant.current = next.grantId
      setHistory(['/'])
      setQuery('')
      setListing(null)
      setPreview(undefined)
      setMediaFiles(undefined)
    }
    setAccess(next)
  }), [])
  useEffect(() => { if (active) void fileWorkspacePort.restoreDirectory().catch((reason: unknown) => setError(getErrorMessage(reason))) }, [active])

  const currentPath = history[history.length - 1] || '/'
  const canManage = fileWorkspacePort.canManageDirectory()
  const load = useCallback(async (path = currentPath, push = false) => {
    if (!active || fileWorkspacePort.getSnapshot().status !== 'ready') return
    const id = ++request.current
    setLoading(true)
    setError('')
    try {
      const next = await fileWorkspacePort.listDirectory(path)
      if (id !== request.current) return
      setListing(next)
      if (push) setHistory((items) => [...items, path])
    } catch (reason) {
      if (id !== request.current) return
      setListing(null)
      setError(getErrorMessage(reason))
    } finally { if (id === request.current) setLoading(false) }
  }, [active, currentPath])

  useEffect(() => {
    if (active && access.status === 'ready') void load(currentPath)
    else if (active) setListing(null)
    return () => { request.current += 1 }
  }, [active, access, currentPath, load])

  useEffect(() => setQuery(''), [currentPath])

  const chooseDirectory = useCallback(async () => {
    setError('')
    try { await fileWorkspacePort.chooseDirectory() }
    catch (reason) { setError(getErrorMessage(reason)) }
  }, [])

  const handleEmptyStateKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    if (access.status !== 'selecting') void chooseDirectory()
  }, [access.status, chooseDirectory])

  const write = useCallback(async (operation: () => Promise<void>) => {
    setWriting(true)
    setError('')
    try {
      await operation()
      await load()
    } catch (reason) { setError(getErrorMessage(reason)) }
    finally { setWriting(false) }
  }, [load])

  const createFolder = useCallback(() => {
    const name = window.prompt('新建文件夹名称')
    if (name) void write(() => fileWorkspacePort.createDirectory(currentPath, name))
  }, [currentPath, write])

  const createDocument = useCallback(() => {
    const name = window.prompt('新建 Markdown 文件名称')
    if (name) void write(() => fileWorkspacePort.createMarkdownFile(currentPath, name))
  }, [currentPath, write])

  const openMedia = useCallback(async (selectedPath: string) => {
    if (!canManage || openingMedia || !listing) return
    setOpeningMedia(true); setError('')
    try {
      const candidates = listing.files.filter(item => MEDIA_EXTENSIONS.has(mediaExtension(item.name))).slice(0, 50)
      const playable: Array<{ path: string; file: File }> = []
      for (const item of candidates) {
        const ref = await fileWorkspacePort.createFileRef(item.path)
        const file = await fileWorkspacePort.localMediaFile(ref)
        if (await hasMediaSignature(file)) playable.push({ path: item.path, file })
      }
      const initialIndex = playable.findIndex(item => item.path === selectedPath)
      if (initialIndex < 0) throw new Error('文件签名未匹配已实现的媒体容器；未启动播放器。')
      setMediaFiles(playable.map(item => item.file)); setMediaIndex(initialIndex)
      if (candidates.length === 50) setNotice('播放列表最多探测当前目录前 50 个媒体候选项。')
    } catch (reason) { setError(getErrorMessage(reason)) }
    finally { setOpeningMedia(false) }
  }, [canManage, listing, openingMedia])

  const deleteEntry = useCallback((name: string, type: 'file' | 'directory') => {
    const label = type === 'directory' ? '空文件夹' : '文件'
    if (window.confirm(`确定删除${label}“${name}”吗？此操作不会进入回收站。`)) {
      void write(() => fileWorkspacePort.deleteEntry(currentPath, name))
    }
  }, [currentPath, write])

  const extractZip = useCallback((name: string) => {
    if (!window.confirm(`将“${name}”解压到当前目录中新建的文件夹。仅处理受限 ZIP，且不会覆盖已有项目。是否继续？`)) return
    setWriting(true)
    setExtracting(true)
    extractionInFlight.current = true
    setError('')
    setNotice('正在在隔离 Worker 中验证并解压 ZIP；完成校验前不会写入目录。')
    void (async () => {
      try {
        const result = await fileWorkspacePort.extractZip(currentPath, name)
        if (!mounted.current) return
        setNotice(`已解压 ${result.filesWritten} 个文件到“${result.directoryName}”。`)
        await load()
      } catch (reason) {
        if (!mounted.current) return
        setNotice('')
        setError(getErrorMessage(reason))
      } finally {
        extractionInFlight.current = false
        if (mounted.current) {
          setExtracting(false)
          setWriting(false)
        }
      }
    })()
  }, [currentPath, load])

  if (access.status !== 'ready') {
    return <section
      className={`fm-local-empty ${access.status === 'selecting' ? 'fm-local-empty--selecting' : ''}`}
      role="button"
      tabIndex={access.status === 'selecting' || !canManage ? -1 : 0}
      aria-label={access.status === 'selecting' ? '正在打开系统目录选择器' : canManage ? '选择本地目录并打开系统目录选择器' : '当前页面只显示目录投影'}
      aria-disabled={access.status === 'selecting' || !canManage}
      aria-live="polite"
      onClick={() => { if (access.status !== 'selecting' && canManage) void chooseDirectory() }}
      onKeyDown={handleEmptyStateKeyDown}
    >
      <div className="fm-local-empty__content">
        <div className="fm-local-empty__icon-surface"><FolderOpen className="fm-local-empty__icon" aria-hidden="true" /></div>
        <div className="fm-local-empty__copy">
          <h2>打开本地目录</h2>
          <p>{error || access.message || '选择一个文件夹，开始浏览文件。'}</p>
        </div>
        <span className="fm-local-empty__action" aria-hidden="true">
          <span><strong>{access.status === 'selecting' ? '正在打开选择器' : '选择目录'}</strong><small>点击窗口任意位置</small></span><ArrowRight />
        </span>
        <p className="fm-local-empty__detail"><ShieldCheck aria-hidden="true" />仅读取目录；需要写入时再确认。</p>
      </div>
    </section>
  }

  const allEntries = listing ? [...listing.directories, ...listing.files] : []
  const entries = directoryEntries(allEntries, query, sort)
  const editable = canManage && access.writeAccess === 'granted'
  const busy = loading || writing
  return <section className="fm-local-browser" aria-label="已授权本地目录">
    <div className="fm-topbar fm-local-toolbar">
      <div className="fm-nav-buttons">
        <button type="button" className="fm-icon-btn" title="返回上一级" disabled={history.length <= 1 || busy} onClick={() => setHistory((items) => items.slice(0, -1))}><BackIcon /></button>
        <button type="button" className="fm-icon-btn" title="刷新" disabled={busy} onClick={() => void load()}><RefreshIcon /></button>
      </div>
      <nav className="fm-address fm-local-breadcrumb" aria-label="目录路径">
        <button type="button" title={access.displayName} aria-label="返回授权目录" disabled={busy || currentPath === '/'} onClick={() => setHistory(['/'])}><Home aria-hidden="true" /><span>{access.displayName}</span></button>
        {history.slice(1).map((path, index) => <span key={path}><ChevronRight aria-hidden="true" /><button type="button" title={decodeURIComponent(path.split('/').at(-1) || '')} disabled={busy || path === currentPath} aria-current={path === currentPath ? 'location' : undefined} onClick={() => setHistory((items) => items.slice(0, index + 2))}>{decodeURIComponent(path.split('/').at(-1) || '')}</button></span>)}
      </nav>
      <div className="fm-local-toolbar__actions">
        <button type="button" className="fm-action-btn fm-local-forget" title={canManage ? '移除保存的目录授权，不会删除本地文件' : '当前页面只显示目录投影'} disabled={busy || !canManage} onClick={() => { void fileWorkspacePort.forgetDirectory().catch((reason: unknown) => setError(getErrorMessage(reason))) }}>忘记此目录</button>
        <button type="button" className="fm-local-change" onClick={() => void chooseDirectory()} disabled={busy || !canManage}>更换目录</button>
        <button type="button" className="fm-action-btn fm-local-toolbar-action" title={editable ? '新建文件夹' : '请先在窗口顶部开启写入模式'} aria-label="新建文件夹" onClick={createFolder} disabled={busy || !editable}><FolderPlusIcon /><span>新建文件夹</span></button>
        <button type="button" className="fm-action-btn fm-local-toolbar-action" title={editable ? '新建 Markdown 文档' : '请先在窗口顶部开启写入模式'} aria-label="新建文档" onClick={createDocument} disabled={busy || !editable}><DocumentPlusIcon /><span>新建文档</span></button>
        {extracting && <button type="button" className="fm-action-btn fm-local-toolbar-action" onClick={() => fileWorkspacePort.cancelZipExtraction()}><span>取消解压</span></button>}
      </div>
    </div>
    <div className="fm-local-commandbar">
      <label className="fm-local-search"><Search aria-hidden="true" /><input type="search" aria-label="搜索当前目录" placeholder="搜索当前目录" value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button type="button" title="清除搜索" aria-label="清除搜索" onClick={() => setQuery('')}><X /></button>}</label>
      <select className="fm-local-sort" aria-label="排序方式" value={sort} onChange={(event) => setSort(event.target.value as DirectorySort)}><option value="name">名称 A–Z</option><option value="modified">最近修改</option><option value="size">大小由大到小</option></select>
    </div>
    <p className="fm-local-notice" role="status">{notice || `${access.message ? `${access.message} ` : ''}仅显示当前目录的直接子项；解压仅处理你明确选择的 ZIP。`}</p>
    {error && <p className="fm-local-error" role="alert">{error}</p>}
    {preview && <FilePreviewPanel key={preview.id} file={preview} reader={previewReader} onClose={() => setPreview(undefined)} onDownload={async ref => {
      await fileWorkspacePort.exportFileRef(ref)
      setNotice('已交给浏览器导出；请在浏览器下载记录中确认保存结果。')
    }} />}
    {openingMedia && <p className="fm-local-notice" role="status">正在检查当前目录中的有限媒体候选项…</p>}
    {mediaFiles && <LocalMediaPlayer files={mediaFiles} initialIndex={mediaIndex} onClose={() => setMediaFiles(undefined)} />}
    <div className="fm-table" aria-busy={busy}>
      <div className="fm-head"><span>文件名</span><span>修改时间</span><span>大小</span><span>类型</span><span /></div>
      <div className="fm-list">
        {loading && <div className="fm-empty">正在读取当前目录...</div>}
        {!loading && entries.map((entry) => (
          <div className="fm-row fm-row--local" key={entry.path}>
            <button type="button" className="fm-local-entry" title={entry.name} onClick={() => entry.type === 'directory' && void load(entry.path, true)} disabled={entry.type !== 'directory' || busy} aria-label={entry.type === 'directory' ? `打开文件夹 ${entry.name}` : `${entry.name}，文件条目`}>
              <span className="fm-name">{entry.type === 'directory' ? <FolderIcon /> : <FileIcon ext={entry.extension} />}<strong>{entry.name}</strong></span>
            </button>
            <span>{entry.modified ? formatDate(entry.modified) : '-'}</span>
            <span>{entry.type === 'file' ? formatSize(entry.size) : '-'}</span>
            <span>{entry.type === 'directory' ? '文件夹' : entry.extension?.toUpperCase() || '文件'}</span>
            <span className="fm-local-row-actions">
              {entry.type === 'file' && <button type="button" className="fm-icon-btn" aria-label="预览文件" title="预览" onClick={() => void fileWorkspacePort.createFileRef(entry.path).then(setPreview, reason => setError(getErrorMessage(reason)))} disabled={busy || !canManage}>预览</button>}
              {entry.type === 'file' && MEDIA_EXTENSIONS.has(mediaExtension(entry.name)) && <button type="button" className="fm-icon-btn" aria-label="在本地播放器中打开" title="播放" onClick={() => void openMedia(entry.path)} disabled={busy || openingMedia || !canManage}>播放</button>}
              {entry.type === 'file' && entry.name.toLowerCase().endsWith('.zip') && <button type="button" className="fm-icon-btn fm-local-extract" title={editable ? `解压 ${entry.name}` : '请先在窗口顶部开启写入模式'} aria-label={`解压 ${entry.name}`} onClick={() => extractZip(entry.name)} disabled={busy || !editable}><ExtractIcon /></button>}
              <button type="button" className="fm-icon-btn fm-local-delete" title={editable ? `删除 ${entry.name}` : '请先在窗口顶部开启写入模式'} aria-label={`删除 ${entry.name}`} onClick={() => deleteEntry(entry.name, entry.type)} disabled={busy || !editable}><TrashIcon /></button>
            </span>
          </div>
        ))}
        {!loading && !error && entries.length === 0 && <div className="fm-empty">{query ? '没有匹配的项目' : '此目录为空'}</div>}
      </div>
    </div>
    {listing?.truncated && <p className="fm-local-notice" role="status">为限制资源使用，仅显示前 200 项；请在系统中缩小目录范围后重新选择。</p>}
    <div className="fm-local-footer">
      <span>{query ? `${entries.length} / ${allEntries.length} 项` : `${listing?.directories.length || 0} 个文件夹 · ${listing?.files.length || 0} 个文件`}</span>
    </div>
  </section>
}
