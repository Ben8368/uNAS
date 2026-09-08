import { useCallback, useEffect, useRef, useState } from 'react'
import { Search, X, FolderOpen, Home, ChevronRight } from 'lucide-react'

import { fileWorkspacePort } from 'unas-src/api/fileWorkspace'
import type { AuthorizedDirectoryListing } from '#contracts'
import { BackIcon, DocumentPlusIcon, FileIcon, FolderIcon, FolderPlusIcon, RefreshIcon, TrashIcon } from 'unas-src/apps/file-manager/controls'
import { formatDate, formatSize } from 'unas-src/apps/file-manager/utils'
import { getErrorMessage } from 'unas-src/utils'
import { directoryEntries, type DirectorySort } from './directoryView'

export function LocalDirectoryPane() {
  const [access, setAccess] = useState(fileWorkspacePort.getSnapshot)
  const [listing, setListing] = useState<AuthorizedDirectoryListing | null>(null)
  const [loading, setLoading] = useState(false)
  const [writing, setWriting] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<string[]>(['/'])
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<DirectorySort>('name')
  const request = useRef(0)
  const previousGrant = useRef(access.grantId)

  useEffect(() => fileWorkspacePort.subscribe(() => {
    const next = fileWorkspacePort.getSnapshot()
    request.current += 1
    if (next.grantId !== previousGrant.current || next.status !== 'ready') {
      previousGrant.current = next.grantId
      setHistory(['/'])
      setQuery('')
      setListing(null)
    }
    setAccess(next)
  }), [])
  useEffect(() => { void fileWorkspacePort.restoreDirectory() }, [])

  const currentPath = history[history.length - 1] || '/'
  const load = useCallback(async (path = currentPath, push = false) => {
    if (fileWorkspacePort.getSnapshot().status !== 'ready') return
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
  }, [currentPath])

  useEffect(() => {
    if (access.status === 'ready') void load(currentPath)
    else setListing(null)
    return () => { request.current += 1 }
  }, [access, currentPath, load])

  useEffect(() => setQuery(''), [currentPath])

  const chooseDirectory = useCallback(async () => {
    setError('')
    await fileWorkspacePort.chooseDirectory()
  }, [])

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

  const deleteEntry = useCallback((name: string, type: 'file' | 'directory') => {
    const label = type === 'directory' ? '空文件夹' : '文件'
    if (window.confirm(`确定删除${label}“${name}”吗？此操作不会进入回收站。`)) {
      void write(() => fileWorkspacePort.deleteEntry(currentPath, name))
    }
  }, [currentPath, write])

  if (access.status !== 'ready') {
    return <section className="fm-local-empty" aria-live="polite">
      <div className="fm-local-empty__content">
        <div className="fm-local-empty__icon-surface"><FolderOpen className="fm-local-empty__icon" aria-hidden="true" /></div>
        <div className="fm-local-empty__copy">
          <span className="fm-local-empty__eyebrow">本地文件工作区</span>
          <h2>选择一个本地目录</h2>
          <p>{access.message || '从一个你常用的文件夹开始。'}</p>
        </div>
        <button type="button" className="fm-action-btn fm-action-btn--primary fm-local-empty__action" onClick={() => void chooseDirectory()} disabled={access.status === 'selecting'}>
          <FolderOpen aria-hidden="true" />{access.status === 'selecting' ? '正在打开目录选择器' : access.status === 'requires-user' ? '重新选择目录' : '选择本地目录'}
        </button>
        <p className="fm-local-empty__detail"><strong>文件始终留在本地</strong><span>选择目录时只请求读取权限；需要写入时，须在窗口顶部确认后再接受浏览器授权。</span></p>
      </div>
    </section>
  }

  const allEntries = listing ? [...listing.directories, ...listing.files] : []
  const entries = directoryEntries(allEntries, query, sort)
  const editable = access.writeAccess === 'granted'
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
        <button type="button" className="fm-action-btn fm-local-toolbar-action" title={editable ? '新建文件夹' : '请先在窗口顶部开启写入模式'} aria-label="新建文件夹" onClick={createFolder} disabled={busy || !editable}><FolderPlusIcon /><span>新建文件夹</span></button>
        <button type="button" className="fm-action-btn fm-local-toolbar-action" title={editable ? '新建 Markdown 文档' : '请先在窗口顶部开启写入模式'} aria-label="新建文档" onClick={createDocument} disabled={busy || !editable}><DocumentPlusIcon /><span>新建文档</span></button>
        <button type="button" className="fm-local-change" onClick={() => void chooseDirectory()} disabled={busy}>更换目录</button>
      </div>
    </div>
    <div className="fm-local-commandbar">
      <label className="fm-local-search"><Search aria-hidden="true" /><input type="search" aria-label="搜索当前目录" placeholder="搜索当前目录" value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button type="button" title="清除搜索" aria-label="清除搜索" onClick={() => setQuery('')}><X /></button>}</label>
      <select className="fm-local-sort" aria-label="排序方式" value={sort} onChange={(event) => setSort(event.target.value as DirectorySort)}><option value="name">名称 A–Z</option><option value="modified">最近修改</option><option value="size">大小由大到小</option></select>
    </div>
    <p className="fm-local-notice" role="status">{access.message && `${access.message} `}仅显示当前目录的直接子项，不读取文件内容。</p>
    {error && <p className="fm-local-error" role="alert">{error}</p>}
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
            <button type="button" className="fm-icon-btn fm-local-delete" title={editable ? `删除 ${entry.name}` : '请先在窗口顶部开启写入模式'} aria-label={`删除 ${entry.name}`} onClick={() => deleteEntry(entry.name, entry.type)} disabled={busy || !editable}><TrashIcon /></button>
          </div>
        ))}
        {!loading && !error && entries.length === 0 && <div className="fm-empty">{query ? '没有匹配的项目' : '此目录为空'}</div>}
      </div>
    </div>
    {listing?.truncated && <p className="fm-local-notice" role="status">为限制资源使用，仅显示前 200 项；请在系统中缩小目录范围后重新选择。</p>}
    <div className="fm-local-footer">
      <button type="button" className="fm-action-btn" title="移除保存的目录授权，不会删除本地文件" disabled={busy} onClick={() => { void fileWorkspacePort.forgetDirectory().catch((reason: unknown) => setError(getErrorMessage(reason))) }}>忘记此目录</button>
      <span>{query ? `${entries.length} / ${allEntries.length} 项` : `${listing?.directories.length || 0} 个文件夹 · ${listing?.files.length || 0} 个文件`}</span>
    </div>
  </section>
}
