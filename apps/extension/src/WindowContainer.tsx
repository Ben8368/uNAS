import { getRegisteredApp } from 'unas-src/appRegistry'
import { useEffect, useLayoutEffect, useRef } from 'react'

import { AppWindow } from 'unas-src/components/AppWindow'
import { WorkspaceAppContent } from 'unas-src/components/WorkspaceAppContent'
import { isWorkspaceApp } from 'unas-src/runtime/workspaceRouter'
import { useWindowStore } from 'unas-src/windowStore'
import { useSystemStore } from 'unas-src/store'

export function WindowContainer() {
  const { windows, closeWindow, minimizeWindow, maximizeWindow, focusWindow, dragWindow, resizeWindow } = useWindowStore()
  const maxZ = Math.max(0, ...windows.filter((w) => !w.isMinimized).map((w) => w.zIndex))
  const container = useRef<HTMLDivElement>(null)
  const previousActiveId = useRef<string | undefined>(undefined)
  const showLauncher = useSystemStore((state) => state.showLauncher)
  const activeId = windows.find((w) => !w.isMinimized && w.zIndex === maxZ)?.id
  // Focus active windows, but do not force the launcher button on initial page load.
  // When a window closes, returning focus to the launcher preserves keyboard flow.
  useLayoutEffect(() => {
    const active = container.current?.querySelector<HTMLElement>('.mt-window--active:not([hidden]):not([data-launch-pending])')
    if (showLauncher) {
      previousActiveId.current = activeId
      return
    }
    if (active) {
      if (!active.contains(document.activeElement)) active.focus({ preventScroll: true })
    } else if (previousActiveId.current && (document.activeElement === document.body || container.current?.contains(document.activeElement))) {
      document.querySelector<HTMLButtonElement>('[aria-label="所有应用"]')?.focus({ preventScroll: true })
    }
    previousActiveId.current = activeId
  }, [activeId, showLauncher])
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!event.altKey) return
      const visible = windows.filter((item) => !item.isMinimized).sort((a, b) => a.zIndex - b.zIndex)
      if (event.key === 'F6' && visible.length) {
        event.preventDefault()
        focusWindow(visible[0].id)
      }
      if (event.shiftKey && event.key.toLowerCase() === 'w' && visible.length) {
        event.preventDefault()
        closeWindow(visible[visible.length - 1].id)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [windows, closeWindow, focusWindow])

  return (
    <div ref={container} className="mt-windows">
      {windows.map((w) => {
        const registeredApp = getRegisteredApp(w.appType)
        if (!registeredApp) return null
        const C = registeredApp.component
        return (
          <AppWindow
            key={w.id}
            windowId={w.id}
            title={registeredApp.title || w.title}
            width={w.width}
            height={w.height}
            x={w.x}
            y={w.y}
            isMaximized={w.isMaximized}
            isMinimized={w.isMinimized}
            isActive={!w.isMinimized && w.zIndex === maxZ}
            zIndex={w.zIndex}
            appType={w.appType}
            onClose={closeWindow}
            onMinimize={minimizeWindow}
            onMaximize={maximizeWindow}
            onFocus={focusWindow}
            onDrag={dragWindow}
            onResize={resizeWindow}
          >
            {isWorkspaceApp(w.appType) ? <WorkspaceAppContent><C /></WorkspaceAppContent> : <C />}
          </AppWindow>
        )
      })}
    </div>
  )
}
