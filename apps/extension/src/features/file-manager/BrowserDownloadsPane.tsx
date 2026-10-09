import { useCallback, useEffect, useState } from 'react'
import { Download, ExternalLink, FolderOpen, RefreshCw } from 'lucide-react'
import { listBrowserDownloadFiles, showBrowserDownloadFile, type BrowserDownloadsFile } from 'unas-src/platform/browser/browserDownloadRecords'
import { openBrowserDownloads } from 'unas-src/platform/browser/browserDownloads'
import { getErrorMessage } from 'unas-src/shared/errors'
import { formatSize } from './utils'
import { ManagedFileTable } from './ManagedFileTable'

function statusLabel(state: BrowserDownloadsFile['state'], exists?: boolean) {
  if (state === 'in_progress') return '下载中'
  if (state === 'interrupted') return '已中断'
  return exists === false ? '文件已移除' : '已完成'
}

export function BrowserDownloadsPane() {
  const [items, setItems] = useState<BrowserDownloadsFile[]>([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const refresh = useCallback(async () => {
    setBusy(true); setError(''); setNotice('')
    try { setItems(await listBrowserDownloadFiles()) }
    catch (reason) { setError(getErrorMessage(reason)) }
    finally { setBusy(false) }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const rows = items.map(item => ({
    id: String(item.id),
    name: item.name,
    size: item.totalBytes >= 0 ? item.totalBytes : item.bytesReceived,
    detail: `${statusLabel(item.state, item.exists)}${item.startTime ? ` · ${new Date(item.startTime).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}`,
  }))

  return <section className="fm-managed-pane" aria-label="浏览器下载">
    <div className="fm-managed-heading"><Download aria-hidden="true" /><div><h2>浏览器下载</h2><p>显示 Chrome 的下载记录，文件保存在浏览器设置的位置。</p></div></div>
    <div className="fm-managed-toolbar">
      <button type="button" className="mt-btn" disabled={busy} onClick={() => void refresh()}><RefreshCw />刷新</button>
      <button type="button" className="mt-btn" onClick={() => void openBrowserDownloads().catch(reason => setError(getErrorMessage(reason)))}><ExternalLink />打开 Chrome 下载页面</button>
    </div>
    <p className="fm-managed-notice">这里不需要选择文件夹。uNAS 只显示文件名和下载状态；需要查看文件时，点击右侧按钮。</p>
    {notice && <p role="status" className="fm-managed-notice">{notice}</p>}
    {error && <p role="alert" className="fm-managed-error">{error}</p>}
    <ManagedFileTable rows={rows} busy={busy} empty={error ? '下载记录读取失败，请检查上方提示。' : '浏览器里还没有下载记录。'} actions={row => {
      const item = items.find(candidate => String(candidate.id) === row.id)
      return <button type="button" className="mt-btn" aria-label={`在文件夹中显示 ${row.name}`} disabled={!item || item.state !== 'complete' || item.exists === false} onClick={() => {
        if (!item) return
        void showBrowserDownloadFile(item.id).then(() => setNotice(`已在文件夹中定位“${item.name}”。`)).catch(reason => setError(getErrorMessage(reason)))
      }}><FolderOpen /></button>
    }} />
    <footer className="fm-managed-footer"><span>最近 {items.length} 条记录{items.length === 200 ? '（最多显示 200 条）' : ''}</span><span>保存位置由 Chrome 管理</span></footer>
  </section>
}
