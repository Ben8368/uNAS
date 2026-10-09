import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { fileWorkspacePort } from 'unas-src/platform/filesystem/fileWorkspace'
import { getFileManagerSection, subscribeFileManagerSection } from './navigation'
export function FileWorkspaceModeControl() {
  const section = useSyncExternalStore(subscribeFileManagerSection, getFileManagerSection)
  const access = useSyncExternalStore(fileWorkspacePort.subscribe, fileWorkspacePort.getSnapshot)
  const [confirming, setConfirming] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const canManage = fileWorkspacePort.canManageDirectory()
  const writable = canManage && access.writeAccess === 'granted'
  const ready = access.status === 'ready'

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (confirming && !dialog.open) dialog.showModal()
    if (!confirming && dialog.open) dialog.close()
  }, [confirming])

  async function enableWriteMode() {
    setRequesting(true)
    try { await fileWorkspacePort.requestWriteAccess() }
    catch { /* The File Manager status region explains why write access was not granted. */ }
    finally {
      setRequesting(false)
      setConfirming(false)
    }
  }

  if (section !== 'local') return null
  return <>
    <button
      type="button"
      className={`mt-window-status mt-window-mode ${writable ? 'mt-window-mode--writable' : ''}`}
      title={!canManage ? '当前页面只显示目录投影；请回到 Workspace owner 页面管理写入模式。' : writable ? '点击后恢复只读模式；不会撤销浏览器已授予的目录权限。' : ready ? '点击后确认并请求浏览器写入授权。' : '请选择本地目录后再开启写入模式。'}
      aria-label={writable ? '写入模式已开启，点击恢复只读模式' : '只读模式，点击开启写入模式'}
      aria-pressed={writable}
      disabled={!ready || !canManage || requesting}
      onClick={() => { if (writable) fileWorkspacePort.disableWriteAccess(); else setConfirming(true) }}
    >{writable ? '可写入' : '只读'}</button>
    <dialog ref={dialogRef} className="mt-write-confirm" aria-labelledby="write-confirm-title" onClose={() => setConfirming(false)} onClick={(event) => { if (event.target === event.currentTarget) setConfirming(false) }}>
      <form method="dialog">
        <h2 id="write-confirm-title">开启写入模式？</h2>
        <p>这会允许文件管理 App 在你已选择的目录中创建或删除直接子项。接下来浏览器还会再次询问是否授予写入权限。</p>
        <p>默认不覆盖同名文件，文件夹不会递归删除。</p>
        <div className="mt-write-confirm__actions">
          <button type="submit" className="mt-write-confirm__cancel" disabled={requesting}>保持只读</button>
          <button type="button" className="mt-write-confirm__allow" disabled={requesting} onClick={() => void enableWriteMode()}>{requesting ? '正在请求授权…' : '继续并授权'}</button>
        </div>
      </form>
    </dialog>
  </>
}
