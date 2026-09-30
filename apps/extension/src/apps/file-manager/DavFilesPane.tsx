import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Download, FolderPlus, LogOut, RefreshCw, Search, Server, Trash2, Upload, X } from 'lucide-react'
import type { DavDirectoryListing } from '#contracts'
import { createDavFilesPort } from 'unas-src/api/davFiles'
import { getErrorMessage } from 'unas-src/utils'
import { directoryEntries } from './directoryView'
import { formatDate } from './utils'
import { ManagedFileTable } from './ManagedFileTable'

export function DavFilesPane() {
  const [port] = useState(createDavFilesPort)
  const [endpoint, setEndpoint] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [consent, setConsent] = useState(false)
  const [connected, setConnected] = useState('')
  const [listing, setListing] = useState<DavDirectoryListing | null>(null)
  const [history, setHistory] = useState([''])
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const mounted = useRef(true)
  const connectController = useRef<AbortController>()
  const inFlight = useRef(false)
  const path = history.at(-1) ?? ''
  useEffect(() => {
    mounted.current = true
    const cancel = () => { connectController.current?.abort(); port.disconnect() }
    window.addEventListener('pagehide', cancel)
    return () => { mounted.current = false; cancel(); window.removeEventListener('pagehide', cancel) }
  }, [port])

  async function run(action: () => Promise<void>, mutation = false) {
    if (inFlight.current) return
    inFlight.current = true; setBusy(true); setError(''); setNotice('')
    try { await action() }
    catch (reason) { if (mounted.current) setError(getErrorMessage(reason)) }
    finally { inFlight.current = false; if (mounted.current) setBusy(false) }
    if (mutation && mounted.current) setQuery('')
  }
  async function load(nextPath: string, nextHistory = history) {
    const next = await port.list(nextPath)
    if (mounted.current) { setListing(next); setHistory(nextHistory); setQuery('') }
  }
  function connect() {
    connectController.current = new AbortController()
    void run(async () => {
      const result = await port.connect({ endpoint, username, appPassword: password, consent }, connectController.current?.signal)
      if (mounted.current) { setConnected(result.endpoint); setListing(result.listing); setHistory(['']); setPassword('') }
    })
  }
  function upload() {
    if (!window.confirm('选择的文件会上传到当前 WebDAV 目录。不会覆盖同名文件。是否继续？')) return
    void run(async () => {
      const uploaded = await port.upload(path)
      if (uploaded && mounted.current) { setNotice('服务器已接受上传。'); await load(path) }
    }, true)
  }

  if (!connected) return <section className="fm-managed-pane">
    <div className="fm-managed-heading"><Server aria-hidden="true" /><div><h2>WebDAV 文件</h2><p>连接你自己的 HTTPS 文件服务器。</p></div></div>
    <form className="fm-dav-form" onSubmit={event => { event.preventDefault(); connect() }}>
      <label className="mt-field">WebDAV 地址<input type="url" required placeholder="https://nas.example/dav/files/" value={endpoint} onChange={event => setEndpoint(event.target.value)} disabled={busy} /></label>
      <label className="mt-field">用户名<input required autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} disabled={busy} /></label>
      <label className="mt-field">App Password<input required type="password" autoComplete="off" value={password} onChange={event => setPassword(event.target.value)} disabled={busy} /></label>
      <label className="fm-managed-consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} disabled={busy} /><span>允许连接此服务器读取目录，并在我点击上传时发送所选文件。</span></label>
      <p className="fm-managed-notice">实验性文件功能。连接凭据仅保留在此页面内存；离开 WebDAV 或关闭页面后需要重新连接。文件连接独立于密码库。</p>
      <div className="fm-managed-toolbar"><button type="submit" className="mt-btn mt-btn--primary" disabled={busy || !consent}>{busy ? '正在连接…' : '连接文件服务器'}</button>{busy && <button type="button" className="mt-btn" onClick={() => { connectController.current?.abort(); port.cancel() }}>取消连接</button>}</div>
      {error && <p role="alert" className="fm-managed-error">{error}</p>}
    </form>
  </section>

  const entries = directoryEntries(listing?.entries ?? [], query, 'name')
  return <section className="fm-managed-pane" aria-label="WebDAV 文件目录">
    <div className="fm-managed-toolbar">
      <button type="button" className="mt-btn" aria-label="返回 WebDAV 上一级" disabled={busy || history.length < 2} onClick={() => void run(() => load(history.at(-2)!, history.slice(0, -1)))}><ArrowLeft /></button>
      <button type="button" className="mt-btn" disabled={busy} onClick={() => void run(() => load(path))}><RefreshCw />刷新</button>
      <button type="button" className="mt-btn mt-btn--primary" disabled={busy} onClick={upload}><Upload />上传文件</button>
      <button type="button" className="mt-btn" disabled={busy} onClick={() => { const name = window.prompt('WebDAV 新建文件夹名称'); if (name) void run(async () => { await port.createDirectory(path, name); await load(path) }, true) }}><FolderPlus />新建文件夹</button>
      <button type="button" className="mt-btn" disabled={busy} onClick={() => { port.disconnect(); setConnected(''); setListing(null); setConsent(false); setError(''); setNotice('') }}><LogOut />断开连接</button>
      {busy && <button type="button" className="mt-btn" onClick={() => port.cancel()}><X />取消请求</button>}
    </div>
    <p className="fm-managed-path" title={`${connected}${path}`}>{connected}{path && decodeURIComponent(path)}</p>
    <label className="fm-local-search"><Search aria-hidden="true" /><input type="search" aria-label="搜索 WebDAV 当前目录" placeholder="搜索当前目录" value={query} onChange={event => setQuery(event.target.value)} /></label>
    <p className="fm-managed-notice" role="status">{notice || '仅列出直接子项；上传/下载单文件上限 16 MiB。删除仅限有强 ETag 的文件，不进入回收站。'}{listing?.truncated && ' 当前仅显示前 200 项。'}</p>
    {error && <p role="alert" className="fm-managed-error">{error}</p>}
    <ManagedFileTable rows={entries.map(entry => ({ id: entry.path, name: entry.name, size: entry.size, directory: entry.type === 'directory', detail: entry.modified ? formatDate(entry.modified) : '—' }))} busy={busy} empty={query ? '没有匹配的项目' : '此目录为空'} open={id => void run(() => load(id, [...history, id]))} actions={row => row.directory ? null : <>
      <button type="button" className="mt-btn" aria-label={`下载 ${row.name}`} disabled={busy} onClick={() => void run(async () => { await port.download(row.id); if (mounted.current) setNotice('已交给浏览器导出；请在浏览器下载中确认保存结果。') })}><Download /></button>
      <button type="button" className="mt-btn mt-btn--danger" aria-label={`删除 WebDAV 文件 ${row.name}`} title="直接删除，不进入回收站" disabled={busy || !listing?.entries.find(entry => entry.path === row.id)?.etag?.match(/^"[^"\r\n]+"$/)} onClick={() => { if (window.confirm(`直接删除远端文件“${row.name}”？此操作不进入回收站，无法在 uNAS 中恢复。`)) void run(async () => { await port.deleteFile(row.id); await load(path) }, true) }}><Trash2 /></button>
    </>} />
    <footer className="fm-managed-footer">{entries.length} 项 · HTTPS WebDAV · 页面内连接</footer>
  </section>
}
