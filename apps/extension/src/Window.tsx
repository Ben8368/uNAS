import { useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode, type PointerEvent } from 'react'
import { getAppIcon } from 'unas-src/icon-library'
import { fileWorkspacePort } from 'unas-src/api/fileWorkspace'
import { fitWindow } from 'unas-src/windowGeometry'

interface WindowProps {
  windowId: string; title: string; width?: number; height?: number; x?: number; y?: number
  isMaximized: boolean; isMinimized: boolean; isActive: boolean; zIndex: number; appType?: string
  isLaunchPending?: boolean
  children: ReactNode
  onClose: (id: string) => void; onMinimize: (id: string) => void; onMaximize: (id: string) => void
  onFocus: (id: string) => void; onDrag: (id: string, x: number, y: number) => void
  onResize: (id: string, width: number, height: number) => void
}

export function DesktopWindow({ windowId, title, width = 960, height = 640, x = 0, y = 0,
  isMaximized, isMinimized, isActive, zIndex, appType, isLaunchPending = false, children, onClose, onMinimize, onMaximize, onFocus, onDrag, onResize }: WindowProps) {
  const root = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ width: 960, height: 640 })
  const drag = useRef<{ x: number; y: number; left: number; top: number; width: number; height: number; resize: boolean } | null>(null)
  const bounds = fitWindow({ width, height, x, y }, viewport)
  const fileWorkspace = appType === 'file-manager'
  useLayoutEffect(() => {
    const parent = root.current?.parentElement
    if (!parent) return
    const update = () => setViewport((previous) => {
      const next = { width: parent.clientWidth, height: parent.clientHeight }
      return previous.width === next.width && previous.height === next.height ? previous : next
    })
    const observer = new ResizeObserver(update)
    observer.observe(parent)
    update()
    return () => observer.disconnect()
  }, [])

  function start(event: PointerEvent<HTMLDivElement>, resize = false) {
    if (isMaximized || (event.target as HTMLElement).closest('button')) return
    onFocus(windowId)
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { x: event.clientX, y: event.clientY, left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height, resize }
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const initial = drag.current
    if (!initial) return
    const dx = event.clientX - initial.x
    const dy = event.clientY - initial.y
    const next = fitWindow({ width: initial.width + (initial.resize ? dx : 0), height: initial.height + (initial.resize ? dy : 0), x: initial.left + (initial.resize ? 0 : dx), y: initial.top + (initial.resize ? 0 : dy) }, viewport)
    if (initial.resize) onResize(windowId, next.width, next.height)
    else onDrag(windowId, next.x, next.y)
  }
  function finish() { drag.current = null }
  return (
    <div ref={root} role="region" aria-label={title} tabIndex={-1} data-app-id={appType} hidden={isMinimized}
      data-launch-pending={isLaunchPending || undefined}
      className={`mt-window ${isActive ? 'mt-window--active' : ''} ${isMaximized ? 'mt-window--maximized' : ''}`}
      style={{ visibility: isLaunchPending ? 'hidden' : undefined, display: isMinimized ? 'none' : undefined, width: isMaximized ? '100%' : bounds.width, height: isMaximized ? '100%' : bounds.height, left: isMaximized ? 0 : bounds.x, top: isMaximized ? 0 : bounds.y, zIndex }}
      onPointerDown={() => onFocus(windowId)} onFocusCapture={() => { if (!isActive) onFocus(windowId) }}>
      <div className="mt-window-header" onPointerDown={(event) => start(event)} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}
        onDoubleClick={(event) => { if (!(event.target as HTMLElement).closest('button')) onMaximize(windowId) }}>
        <div className="mt-window-brand"><img src={getAppIcon(appType ?? '')} alt="" /><strong>{title}</strong></div>
        <div className="mt-window-controls">
          {fileWorkspace ? <FileWorkspaceModeControl /> : <span className="mt-window-status" title="executionSource: mock；不读取真实文件或执行转换">模拟</span>}
          <button type="button" className="mt-window-btn" aria-label={`最小化${title}`} title="最小化" onClick={() => onMinimize(windowId)}>−</button>
          <button type="button" className="mt-window-btn" aria-label={`${isMaximized ? '还原' : '最大化'}${title}`} title={isMaximized ? '还原' : '最大化'} onClick={() => onMaximize(windowId)}>□</button>
          <button type="button" className="mt-window-btn" aria-label={`关闭${title}`} title="关闭" onClick={() => onClose(windowId)}>×</button>
        </div>
      </div>
      <div className="mt-window-body">{children}</div>
      {!isMaximized && <div className="mt-resize-handle mt-resize-se" title="拖动调整窗口大小；也可使用最大化按钮" onPointerDown={(event) => start(event, true)} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} />}
    </div>
  )
}

function FileWorkspaceModeControl() {
  const access = useSyncExternalStore(fileWorkspacePort.subscribe, fileWorkspacePort.getSnapshot)
  const [confirming, setConfirming] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const writable = access.writeAccess === 'granted'
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

  return <>
    <button
      type="button"
      className={`mt-window-status mt-window-mode ${writable ? 'mt-window-mode--writable' : ''}`}
      title={writable ? '点击后恢复只读模式；不会撤销浏览器已授予的目录权限。' : ready ? '点击后确认并请求浏览器写入授权。' : '请选择本地目录后再开启写入模式。'}
      aria-label={writable ? '写入模式已开启，点击恢复只读模式' : '只读模式，点击开启写入模式'}
      aria-pressed={writable}
      disabled={!ready || requesting}
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
