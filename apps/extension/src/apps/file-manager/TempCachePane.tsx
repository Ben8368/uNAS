import { useCallback, useEffect, useRef, useState } from 'react'
import { Database, Download, RefreshCw, Search, ShieldCheck, Trash2, Undo2, Upload } from 'lucide-react'
import type { CacheSnapshot } from '#contracts'
import { tempCachePort } from 'unas-src/api/tempCache'
import { getErrorMessage } from 'unas-src/utils'
import { formatSize } from './utils'
import { ManagedFileTable } from './ManagedFileTable'

export function TempCachePane({ trash }: { trash: boolean }) {
  const [snapshot, setSnapshot] = useState<CacheSnapshot | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const mounted = useRef(true)
  const request = useRef(0)
  const inFlight = useRef(false)
  const refresh = useCallback(async () => {
    const ticket = ++request.current
    const next = await tempCachePort.list()
    if (mounted.current && ticket === request.current) setSnapshot(next)
  }, [])
  useEffect(() => {
    mounted.current = true
    setError(''); setQuery(''); setNotice('')
    setBusy(true)
    void refresh().catch(reason => { if (mounted.current) setError(getErrorMessage(reason)) }).finally(() => { if (mounted.current) setBusy(false) })
    return () => { mounted.current = false; request.current++ }
  }, [refresh, trash])

  async function run(action: () => Promise<void>) {
    if (inFlight.current) return
    inFlight.current = true; setBusy(true); setError(''); setNotice('')
    try { await action(); await refresh() }
    catch (reason) { if (mounted.current) setError(getErrorMessage(reason)) }
    finally { inFlight.current = false; if (mounted.current) setBusy(false) }
  }
  const entries = (snapshot?.entries ?? []).filter(entry => (entry.trashedAt !== undefined) === trash)
  const filtered = entries.filter(entry => entry.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).sort((left, right) => right.createdAt - left.createdAt)
  return <section className="fm-managed-pane" aria-label={trash ? '临时缓存回收站' : '扩展临时缓存'}>
    <div className="fm-managed-toolbar">
      {!trash && <button type="button" className="mt-btn mt-btn--primary" disabled={busy} onClick={() => void run(async () => { if (await tempCachePort.importFile()) setNotice('文件已复制到临时缓存。') })}><Upload />添加缓存文件</button>}
      <button type="button" className="mt-btn" disabled={busy} onClick={() => void run(async () => {})}><RefreshCw />刷新</button>
      {!trash && <button type="button" className="mt-btn" disabled={busy || snapshot?.protected} onClick={() => void run(async () => { await tempCachePort.requestStorage(); setNotice('浏览器已批准持久存储保护；不会增加可用磁盘容量，缓存仍遵守应用上限。') })}><ShieldCheck />{snapshot?.protected ? '存储已保护' : '申请持久存储'}</button>}
      <button type="button" className="mt-btn mt-btn--danger" disabled={busy || entries.length === 0} onClick={() => { if (window.confirm(`${trash ? '清空回收站' : '清空临时缓存'}？这些缓存副本将永久删除，原始文件保持不变。`)) void run(() => tempCachePort.clear(trash)) }}><Trash2 />{trash ? '清空回收站' : '清空缓存'}</button>
    </div>
    <div className="fm-managed-heading">{trash ? <Trash2 aria-hidden="true" /> : <Database aria-hidden="true" />}<div><h2>{trash ? '回收站' : '临时缓存'}</h2><p>{trash ? '这里只放从临时缓存移除的文件。' : '用于短期保存文件副本，不会改动原文件。'}</p></div></div>
    {!trash && <><p className="fm-managed-notice">点击“添加缓存文件”并选择文件，uNAS 会复制一份到这里。缓存最多保留 24 小时；打开或刷新此页时会清理过期文件。</p><p className="fm-managed-notice">每个文件最多 32 MiB；最多 200 个文件，总量 256 MiB。</p></>}
    {trash && <p className="fm-managed-notice">缓存到期后会自动清理；恢复文件不会延长保留时间。</p>}
    {trash && <p className="fm-managed-notice">本地文件与 WebDAV 的直接删除不进入此回收站。</p>}
    <label className="fm-local-search"><Search aria-hidden="true" /><input type="search" aria-label={trash ? '搜索回收站' : '搜索临时缓存'} placeholder="搜索文件" value={query} onChange={event => setQuery(event.target.value)} /></label>
    {notice && <p role="status" className="fm-managed-notice">{notice}</p>}
    {error && <p role="alert" className="fm-managed-error">{error}</p>}
    <ManagedFileTable rows={filtered.map(entry => ({ id: entry.id, name: entry.name, size: entry.size, detail: new Date(entry.expiresAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' 到期' }))} busy={busy} empty={error ? '缓存读取未完成，请检查上方提示。' : query ? '没有匹配的项目' : trash ? '回收站为空' : '尚无临时缓存，可添加一个文件。'} actions={row => trash ? <>
      <button type="button" className="mt-btn" aria-label={`恢复 ${row.name}`} disabled={busy} onClick={() => void run(() => tempCachePort.restore(row.id))}><Undo2 /></button>
      <button type="button" className="mt-btn mt-btn--danger" aria-label={`彻底删除 ${row.name}`} disabled={busy} onClick={() => { if (window.confirm(`永久删除缓存副本“${row.name}”？此操作无法恢复。`)) void run(() => tempCachePort.purge(row.id)) }}><Trash2 /></button>
    </> : <>
      <button type="button" className="mt-btn" aria-label={`导出 ${row.name}`} disabled={busy} onClick={() => void run(async () => { await tempCachePort.exportFile(row.id); setNotice('已交给浏览器导出；请在浏览器下载中确认保存结果。') })}><Download /></button>
      <button type="button" className="mt-btn mt-btn--danger" aria-label={`移入回收站 ${row.name}`} disabled={busy} onClick={() => void run(() => tempCachePort.moveToTrash(row.id))}><Trash2 /></button>
    </>} />
    <footer className="fm-managed-footer"><span>{filtered.length} 项 · 缓存总占用 {formatSize(snapshot?.usedBytes ?? 0)} / 256 MiB</span><span>{snapshot?.protected ? '存储已保护' : '浏览器默认配额'}{snapshot?.quota ? ` · 扩展配额 ${formatSize(snapshot.quota)}` : ''}</span></footer>
  </section>
}
