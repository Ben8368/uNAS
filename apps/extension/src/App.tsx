import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { LeftNavbar } from 'unas-src/LeftNavbar'
import { AppLauncher } from 'unas-src/AppLauncher'
import { WindowContainer } from 'unas-src/WindowContainer'
import { DesktopIcons } from 'unas-src/DesktopIcons'
import { RightPanel } from 'unas-src/components/RightPanel'
import { useWindowStore } from 'unas-src/windowStore'
import { useSystemStore } from 'unas-src/store'
import { useAppearance } from 'unas-src/hooks/useAppearance'
import { useWorkspaceSession } from 'unas-src/hooks/useWorkspaceSession'
import { isWorkspaceSurface } from 'unas-src/runtime/extensionAdapter'
import { isWorkspaceApp } from 'unas-src/runtime/workspaceRouter'
import { launchStatus } from 'unas-src/runtime/launchStatus'

export default function App() {
  const { openWindow } = useWindowStore()
  const { setShowLauncher } = useSystemStore()
  const workspace = isWorkspaceSurface()
  const session = useWorkspaceSession(workspace)
  const launchError = useSyncExternalStore(launchStatus.subscribe, launchStatus.getSnapshot)
  useAppearance()

  const handleOpenApp = useCallback((id: string) => {
    openWindow(id)
    setShowLauncher(false)
  }, [openWindow, setShowLauncher])

  useEffect(() => {
    if (!workspace || session.state !== 'owner') return
    const openRoute = () => { const app = location.hash.slice(1); if (isWorkspaceApp(app)) openWindow(app) }
    const onVisible = () => { if (!document.hidden) openRoute() }
    openRoute()
    window.addEventListener('hashchange', openRoute)
    document.addEventListener('visibilitychange', onVisible)
    return () => { window.removeEventListener('hashchange', openRoute); document.removeEventListener('visibilitychange', onVisible) }
  }, [workspace, session.state, openWindow])

  return (
    <div className="mt-desktop">
      <LeftNavbar />
      {launchError && <p className="desktop-launch-notice" role="alert">{launchError}</p>}
      <div className="mt-main">
        {(!workspace || session.state === 'owner') && <DesktopIcons onOpenApp={handleOpenApp} />}
        {workspace && session.state !== 'owner' && <section className="workspace-status" role="status"><h1>Workspace {session.state === 'pending' ? '正在确认所有权' : session.state === 'conflict' ? '已在另一标签页运行' : '所有权能力不可用'}</h1><p>此页面不会执行模拟任务。关闭其他 Workspace 后可重试；真实任务恢复能力尚未接入。</p><button type="button" onClick={session.retry}>重新确认所有权</button></section>}
      </div>
      {(!workspace || session.state === 'owner') && <><WindowContainer /><AppLauncher onOpenApp={handleOpenApp} /></>}
      {(!workspace || session.state === 'owner') && <RightPanel />}
    </div>
  )
}
