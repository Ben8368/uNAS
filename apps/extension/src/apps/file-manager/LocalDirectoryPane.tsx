import { useCallback, useEffect, useState } from 'react'

import {
  authorizeFileManagerDirectory,
  createAuthorizedDirectory,
  createAuthorizedMarkdownFile,
  deleteAuthorizedDirectoryEntry,
  forgetFileManagerDirectory,
  getFileWorkspaceSnapshot,
  listAuthorizedDirectory,
  requestFileManagerDirectoryWriteAccess,
  restoreFileManagerDirectory,
  subscribeFileWorkspace,
} from 'unas-src/api/fileWorkspace'
import type { AuthorizedDirectoryListing } from '#contracts'
import { BackIcon, DocumentPlusIcon, FileIcon, FolderIcon, FolderPlusIcon, RefreshIcon, TrashIcon } from 'unas-src/apps/file-manager/controls'
import { formatDate, formatSize } from 'unas-src/apps/file-manager/utils'
import { getErrorMessage } from 'unas-src/utils'

export function LocalDirectoryPane() {
  const [access, setAccess] = useState(getFileWorkspaceSnapshot)
  const [listing, setListing] = useState<AuthorizedDirectoryListing | null>(null)
  const [loading, setLoading] = useState(false)
  const [writing, setWriting] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<string[]>(['/'])

  useEffect(() => subscribeFileWorkspace(() => setAccess(getFileWorkspaceSnapshot())), [])
  useEffect(() => { void restoreFileManagerDirectory() }, [])

  const currentPath = history[history.length - 1] || '/'
  const load = useCallback(async (path = currentPath, push = false) => {
    if (getFileWorkspaceSnapshot().status !== 'ready') return
    setLoading(true)
    setError('')
    try {
      const next = await listAuthorizedDirectory(path)
      setListing(next)
      if (push) setHistory((items) => [...items, path])
    } catch (reason) {
      setListing(null)
      setError(getErrorMessage(reason))
    } finally { setLoading(false) }
  }, [currentPath])

  useEffect(() => {
    if (access.status === 'ready') void load(currentPath)
    else setListing(null)
  }, [access.status, currentPath, load])

  const chooseDirectory = useCallback(async () => {
    setError('')
    await authorizeFileManagerDirectory()
  }, [])

  const requestEdit = useCallback(async () => {
    setError('')
    try { await requestFileManagerDirectoryWriteAccess() }
    catch (reason) { setError(getErrorMessage(reason)) }
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
    if (name) void write(() => createAuthorizedDirectory(currentPath, name))
  }, [currentPath, write])

  const createDocument = useCallback(() => {
    const name = window.prompt('新建 Markdown 文件名称')
    if (name) void write(() => createAuthorizedMarkdownFile(currentPath, name))
  }, [currentPath, write])

  const deleteEntry = useCallback((name: string, type: 'file' | 'directory') => {
    const label = type === 'directory' ? '空文件夹' : '文件'
    if (window.confirm(`确定删除${label}“${name}”吗？此操作不会进入回收站。`)) {
      void write(() => deleteAuthorizedDirectoryEntry(currentPath, name))
    }
  }, [currentPath, write])

  if (access.status !== 'ready') {
    return <section className="fm-local-empty" aria-live="polite">
      <h2>选择本地目录</h2>
      <p>{access.message && `${access.message} `}仅在你明确选择目录后，uNAS 才会列出该目录的直接子项。不会扫描磁盘、读取文件内容或访问浏览器下载目录。</p>
      <button type="button" className="fm-action-btn fm-action-btn--primary" onClick={() => void chooseDirectory()} disabled={access.status === 'selecting'}>
        {access.status === 'selecting' ? '正在打开目录选择器' : access.status === 'requires-user' ? '重新选择目录' : '选择本地目录'}
      </button>
      <p className="fm-local-empty__detail">目录授权由浏览器保存。编辑权限只会在你点击“启用编辑”或新选目录时请求。</p>
    </section>
  }

  const entries = listing ? [...listing.directories, ...listing.files] : []
  return <section className="fm-local-browser" aria-label="已授权本地目录">
    <div className="fm-topbar fm-local-toolbar">
      <div className="fm-nav-buttons">
        <button type="button" className="fm-icon-btn" title="返回上一级" disabled={history.length <= 1 || loading} onClick={() => setHistory((items) => items.slice(0, -1))}><BackIcon /></button>
        <button type="button" className="fm-icon-btn" title="刷新" disabled={loading} onClick={() => void load()}><RefreshIcon /></button>
      </div>
      <div className="fm-address">{listing?.displayPath || access.displayName}</div>
      <div className="fm-local-toolbar__actions">
        {access.writeAccess !== 'granted' && <button type="button" className="fm-action-btn fm-action-btn--primary" onClick={() => void requestEdit()} disabled={writing}>启用编辑</button>}
        <button type="button" className="fm-action-btn fm-local-toolbar-action" onClick={createFolder} disabled={writing || access.writeAccess !== 'granted'}><FolderPlusIcon /><span>新建文件夹</span></button>
        <button type="button" className="fm-action-btn fm-local-toolbar-action" onClick={createDocument} disabled={writing || access.writeAccess !== 'granted'}><DocumentPlusIcon /><span>新建文档</span></button>
        <button type="button" className="fm-local-change" onClick={() => void chooseDirectory()} disabled={writing}>更换目录</button>
      </div>
    </div>
    <p className="fm-local-notice" role="status">{access.writeAccess === 'granted' ? '已启用编辑。' : '当前目录只读。'}{access.message && ` ${access.message}`} 仅显示当前目录的直接子项；不会递归扫描或执行本地程序。</p>
    {error && <p className="fm-local-error" role="alert">{error}</p>}
    <div className="fm-table">
      <div className="fm-head"><span>文件名</span><span>修改时间</span><span>大小</span><span>类型</span><span /></div>
      <div className="fm-list">
        {loading && <div className="fm-empty">正在读取当前目录...</div>}
        {!loading && entries.map((entry) => (
          <div className="fm-row fm-row--local" key={entry.path}>
            <button type="button" className="fm-local-entry" onClick={() => entry.type === 'directory' && void load(entry.path, true)} disabled={entry.type !== 'directory'} aria-label={entry.type === 'directory' ? `打开文件夹 ${entry.name}` : `${entry.name}，文件条目`}>
              <span className="fm-name">{entry.type === 'directory' ? <FolderIcon /> : <FileIcon ext={entry.extension} />}<strong>{entry.name}</strong></span>
            </button>
            <span>{entry.modified ? formatDate(entry.modified) : '-'}</span>
            <span>{entry.type === 'file' ? formatSize(entry.size) : '-'}</span>
            <span>{entry.type === 'directory' ? '文件夹' : entry.extension?.toUpperCase() || '文件'}</span>
            <button type="button" className="fm-icon-btn fm-local-delete" title={access.writeAccess === 'granted' ? `删除${entry.name}` : '需先启用编辑权限'} aria-label={`删除 ${entry.name}`} onClick={() => deleteEntry(entry.name, entry.type)} disabled={writing || access.writeAccess !== 'granted'}><TrashIcon /></button>
          </div>
        ))}
        {!loading && !error && entries.length === 0 && <div className="fm-empty">此目录为空</div>}
      </div>
    </div>
    {listing?.truncated && <p className="fm-local-notice" role="status">为限制资源使用，仅显示前 200 项；请在系统中缩小目录范围后重新选择。</p>}
    <div className="fm-local-footer">
      <button type="button" className="fm-action-btn" onClick={() => void forgetFileManagerDirectory()}>忘记此目录</button>
      <span>不会删除本地文件。</span>
    </div>
  </section>
}
