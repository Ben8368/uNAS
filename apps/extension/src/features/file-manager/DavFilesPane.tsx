import { webDavConnections, type WebDavConnection } from 'unas-src/platform/webdav/connections'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Download, FolderPlus, LogOut, RefreshCw, Search, Server, Trash2, Upload, X } from 'lucide-react'
import type { DavDirectoryListing, FileRef } from '#contracts'
import { davFilesSession } from 'unas-src/platform/webdav/davFiles'
import { getErrorMessage } from 'unas-src/shared/errors'
import { directoryEntries } from './directoryView'
import { formatDate } from './utils'
import { ManagedFileTable } from './ManagedFileTable'
import { FilePreviewPanel, type FilePreviewHandle } from './FilePreviewPanel'
import { createPreviewReader } from './previewRead'

export function DavFilesPane({ active = true }: { active?: boolean }) {
  const port = davFilesSession
  const session = port.getSessionSnapshot()
  const [connections, setConnections] = useState<WebDavConnection[]>([])
  const [connectionId, setConnectionId] = useState('')
  const [loadingConnections, setLoadingConnections] = useState(false)
  useEffect(() => {
    if (!active) return
    let alive = true
    let revision = 0
    const refresh = () => {
      const current = ++revision
      setLoadingConnections(true)
      void webDavConnections.list().then(items => {
        if (alive && current === revision) {
          setConnections(items)
          setConnectionId(current => items.some(item => item.id === current) ? current : items[0]?.id ?? '')
        }
      }).catch((reason: unknown) => { if (alive && current === revision) setError(getErrorMessage(reason)) })
        .finally(() => { if (alive && current === revision) setLoadingConnections(false) })
    }
    refresh()
    const unsubscribe = webDavConnections.subscribe(refresh)
    return () => { alive = false; unsubscribe() }
  }, [active])
  const [connected, setConnected] = useState(session?.endpoint ?? '')
  const [listing, setListing] = useState<DavDirectoryListing | null>(session?.listing ?? null)
  const [history, setHistory] = useState(() => {
    const path = session?.listing.path ?? ''
    const segments = path.split('/').filter(Boolean)
    return ['', ...segments.map((_, index) => segments.slice(0, index + 1).join('/') + '/')]
  })
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [preview, setPreview] = useState<FileRef>()
  const previewRef = useRef<FilePreviewHandle>(null)
  const mounted = useRef(true)
  const connectController = useRef<AbortController | undefined>(undefined)
  const inFlight = useRef(false)
  const path = history.at(-1) ?? ''
  const previewReader = useMemo(() => createPreviewReader('webdav', port.fileMetadata, port.openRead), [port])

  useEffect(() => {
    mounted.current = true
    const cancel = () => { connectController.current?.abort(); port.disconnect() }
    window.addEventListener('pagehide', cancel)
    return () => { mounted.current = false; connectController.current?.abort(); window.removeEventListener('pagehide', cancel) }
  }, [port])

  async function run(action: () => Promise<void>, mutation = false) {
    if (inFlight.current) return
    inFlight.current = true; setBusy(true); setError(''); setNotice('')
    try { await action() }
    catch (reason) { if (mounted.current) setError(getErrorMessage(reason)) }
    finally { inFlight.current = false; if (mounted.current) setBusy(false) }
    if (mutation && mounted.current) setQuery('')
  }
  function leavePreview() {
    if (previewRef.current && !previewRef.current.confirmLeave()) return false
    setPreview(undefined)
    return true
  }
  async function load(nextPath: string, nextHistory = history) {
    if (nextPath !== path && !leavePreview()) return
    const next = await port.list(nextPath)
    if (mounted.current) { setListing(next); setHistory(nextHistory); setQuery('') }
  }
  function connect() {
    const connection = connections.find(item => item.id === connectionId)
    if (!connection) return
    connectController.current = new AbortController()
    void run(async () => {
      const result = await port.connect({ endpoint: connection.endpoint, connectionId, consent: true }, connectController.current?.signal)
      if (mounted.current) { setConnected(result.endpoint); setListing(result.listing); setHistory(['']) }
    })
  }
  function upload() {
    if (!window.confirm('选择的文件会上传到当前 WebDAV 目录。不会覆盖同名文件。是否继续？')) return
    void run(async () => {
      const uploaded = await port.upload(path)
      if (uploaded && mounted.current) { setNotice('服务器已接受上传。'); await load(path) }
    }, true)
  }

  if (!connected) return <section className="fm-managed-pane fm-dav-connect">
    <div className="fm-managed-heading"><Server aria-hidden="true" /><div><h2>WebDAV 文件</h2><p>使用项目共享连接，浏览服务器中的文件。</p></div></div>
    <form className="fm-dav-form" onSubmit={event => { event.preventDefault(); connect() }}>
      <h3>{connections.length ? '选择文件服务器' : '连接你的文件服务器'}</h3>
      <p className="fm-managed-notice">在设置中配置一次 WebDAV，文件管理与密码管家即可共用，无需重复填写账号密码。</p>
      {connections.length > 0 && <><label className="mt-field">共享 WebDAV 连接<select value={connectionId} onChange={event => setConnectionId(event.target.value)} disabled={busy || loadingConnections}>{connections.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><p className="fm-managed-path">{connections.find(item => item.id === connectionId)?.endpoint}</p></>}
      {loadingConnections && <p role="status">正在读取共享连接…</p>}
      <div className="fm-dav-connect-actions">{connections.length > 0 && <button type="submit" className="mt-btn mt-btn--primary" disabled={busy || loadingConnections}>{busy ? '正在连接…' : '浏览文件'}</button>}<a href="#settings" className={connections.length ? 'mt-btn' : 'mt-btn mt-btn--primary'}>管理共享连接</a>{busy && <button type="button" className="mt-btn" onClick={() => { connectController.current?.abort(); port.cancel() }}>取消连接</button>}</div>
      {error && <p role="alert" className="fm-managed-error">{error}</p>}
    </form>
  </section>

  const entries = directoryEntries(listing?.entries ?? [], query, 'name')
  return <section className="fm-managed-pane" aria-label="WebDAV 文件目录">
    <div className="fm-managed-heading"><Server aria-hidden="true" /><div><h2>{connections.find(item => item.endpoint === connected)?.name || 'WebDAV 文件'}</h2><p>项目共享连接</p></div></div>
    <div className="fm-managed-toolbar">
      <button type="button" className="mt-btn" aria-label="返回 WebDAV 上一级" disabled={busy || history.length < 2} onClick={() => void run(() => load(history.at(-2)!, history.slice(0, -1)))}><ArrowLeft /></button>
      <button type="button" className="mt-btn" disabled={busy} onClick={() => void run(() => load(path))}><RefreshCw />刷新</button>
      <button type="button" className="mt-btn mt-btn--primary" disabled={busy} onClick={upload}><Upload />上传文件</button>
      <button type="button" className="mt-btn" disabled={busy} onClick={() => { const name = window.prompt('WebDAV 新建文件夹名称'); if (name) void run(async () => { await port.createDirectory(path, name); await load(path) }, true) }}><FolderPlus />新建文件夹</button>
      <button type="button" className="mt-btn" disabled={busy} onClick={() => { if (!leavePreview()) return; port.disconnect(); setConnected(''); setListing(null); setError(''); setNotice('') }}><LogOut />断开连接</button>
      {busy && <button type="button" className="mt-btn" onClick={() => port.cancel()}><X />取消请求</button>}
    </div>
    <div className="fm-dav-location-bar"><p className="fm-managed-path" title={`${connected}${path}`}>{connected}{path && decodeURIComponent(path)}</p>
    <label className="fm-local-search"><Search aria-hidden="true" /><input type="search" aria-label="搜索 WebDAV 当前目录" placeholder="搜索当前目录" value={query} onChange={event => setQuery(event.target.value)} /></label></div>
    {notice && <p className="fm-managed-notice" role="status">{notice}</p>}
    {listing?.truncated && <p className="fm-managed-notice" role="status">当前仅显示前 200 项。</p>}
    {error && <p role="alert" className="fm-managed-error">{error}</p>}
    {preview && <FilePreviewPanel key={preview.id} ref={previewRef} file={preview} reader={previewReader} onClose={() => setPreview(undefined)} onSaveText={(ref, value) => port.saveText(ref, value)} onDownload={async ref => {
      if (ref.size > 16 * 1024 * 1024) throw new Error('当前直接下载上限为 16 MiB。')
      await port.download(listing?.entries.find(entry => entry.name === ref.name)?.path ?? '')
    }} />}
    <ManagedFileTable rows={entries.map(entry => ({ id: entry.path, name: entry.name, size: entry.size, directory: entry.type === 'directory', detail: entry.modified ? formatDate(entry.modified) : '—' }))} busy={busy} empty={query ? '没有匹配的项目' : '此目录为空'} open={id => void run(() => load(id, [...history, id]))} actions={row => row.directory ? null : <>
      <button type="button" className="mt-btn" aria-label={`预览 ${row.name}`} disabled={busy} onClick={() => { if (leavePreview()) void run(async () => { const next = await port.createFileRef(row.id); if (mounted.current) setPreview(next) }) }}>预览</button>
      <button type="button" className="mt-btn" aria-label={`下载 ${row.name}`} disabled={busy} onClick={() => void run(async () => { await port.download(row.id); if (mounted.current) setNotice('已交给浏览器导出；请在浏览器下载中确认保存结果。') })}><Download /></button>
      <button type="button" className="mt-btn mt-btn--danger" aria-label={`删除 WebDAV 文件 ${row.name}`} title="直接删除，不进入回收站" disabled={busy || !listing?.entries.find(entry => entry.path === row.id)?.etag?.match(/^"[^"\r\n]+"$/)} onClick={() => { if (window.confirm(`直接删除远端文件“${row.name}”？此操作不进入回收站，无法在 uNAS 中恢复。`)) void run(async () => { await port.deleteFile(row.id); await load(path) }, true) }}><Trash2 /></button>
    </>} />
    <footer className="fm-managed-footer"><span>{entries.length} 项 · HTTPS WebDAV</span><details><summary>传输与删除说明</summary><p>上传/下载单文件上限 16 MiB。删除不进入回收站；密码库目录由系统保护。</p></details></footer>
  </section>
}
