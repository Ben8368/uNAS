import { Suspense, useCallback, useEffect, useLayoutEffect, useState, type ComponentProps, type ReactNode } from 'react'
import { AppLoadBoundary } from './AppLoadBoundary'
import { DesktopWindow } from 'unas-src/Window'
import { useSystemStore } from 'unas-src/store'

function ReadyContent({ onReady, children }: { onReady: () => void; children: ReactNode }) {
  useLayoutEffect(onReady, [onReady])
  return children
}

/** Fast loads reveal the content and window together; slow loads keep operable chrome. */
export function AppWindow(props: ComponentProps<typeof DesktopWindow>) {
  const [ready, setReady] = useState(false)
  const [slow, setSlow] = useState(false)
  const onReady = useCallback(() => setReady(true), [])
  const revealed = ready || slow
  useEffect(() => {
    if (ready) return
    const timer = setTimeout(() => setSlow(true), 150)
    return () => clearTimeout(timer)
  }, [ready])
  useLayoutEffect(() => {
    if (!revealed || props.isMinimized || !props.isActive || useSystemStore.getState().showLauncher) return
    const active = document.querySelector<HTMLElement>('.mt-window--active:not([hidden])')
    if (active && !active.contains(document.activeElement)) active.focus({ preventScroll: true })
  }, [revealed, props.isActive, props.isMinimized])
  return <DesktopWindow {...props} isLaunchPending={!revealed}>
    <AppLoadBoundary resetKey={props.appType ?? ''} onFailed={onReady}>
      <Suspense fallback={<div className="mt-app-loading" role="status">正在打开{props.title}…</div>}>
        <ReadyContent onReady={onReady}>{props.children}</ReadyContent>
      </Suspense>
    </AppLoadBoundary>
  </DesktopWindow>
}
