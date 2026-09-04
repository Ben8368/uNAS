import { useEffect, useRef, useState, type ReactNode, type PointerEvent } from 'react'
import { getAppIcon } from 'unas-src/icon-library'
import { fitWindow } from 'unas-src/windowGeometry'

interface WindowProps {
  windowId: string; title: string; width?: number; height?: number; x?: number; y?: number
  isMaximized: boolean; isMinimized: boolean; isActive: boolean; zIndex: number; appType?: string
  children: ReactNode
  onClose: (id: string) => void; onMinimize: (id: string) => void; onMaximize: (id: string) => void
  onFocus: (id: string) => void; onDrag: (id: string, x: number, y: number) => void
  onResize: (id: string, width: number, height: number) => void
}

export function DesktopWindow({ windowId, title, width = 960, height = 640, x = 0, y = 0,
  isMaximized, isMinimized, isActive, zIndex, appType, children, onClose, onMinimize, onMaximize, onFocus, onDrag, onResize }: WindowProps) {
  const root = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ width: 960, height: 640 })
  const drag = useRef<{ x: number; y: number; left: number; top: number; width: number; height: number; resize: boolean } | null>(null)
  const bounds = fitWindow({ width, height, x, y }, viewport)
  useEffect(() => {
    const parent = root.current?.parentElement
    if (!parent) return
    const update = () => setViewport({ width: parent.clientWidth, height: parent.clientHeight })
    const observer = new ResizeObserver(update)
    observer.observe(parent)
    update()
    return () => observer.disconnect()
  }, [isMinimized])
  useEffect(() => {
    if (!isActive || isMinimized) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const element = root.current
    element?.focus({ preventScroll: true })
    return () => {
      if (element?.contains(document.activeElement) || document.activeElement === document.body) {
        if (previous?.isConnected) previous.focus({ preventScroll: true })
        else document.querySelector<HTMLButtonElement>('[aria-label="所有应用"]')?.focus()
      }
    }
  }, [isActive, isMinimized])

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
  if (isMinimized) return null
  return (
    <div ref={root} role="region" aria-label={title} tabIndex={-1} data-app-id={appType}
      className={`mt-window ${isActive ? 'mt-window--active' : ''} ${isMaximized ? 'mt-window--maximized' : ''}`}
      style={{ width: isMaximized ? '100%' : bounds.width, height: isMaximized ? '100%' : bounds.height, left: isMaximized ? 0 : bounds.x, top: isMaximized ? 0 : bounds.y, zIndex }}
      onPointerDown={() => onFocus(windowId)} onFocusCapture={() => { if (!isActive) onFocus(windowId) }}>
      <div className="mt-window-header" onPointerDown={(event) => start(event)} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}
        onDoubleClick={(event) => { if (!(event.target as HTMLElement).closest('button')) onMaximize(windowId) }}>
        <div className="mt-window-brand"><img src={getAppIcon(appType ?? '')} alt="" /><strong>{title}</strong></div>
        <div className="mt-window-controls">
          <span className="mt-window-status" title="executionSource: mock；不读取真实文件或执行转换">模拟</span>
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
