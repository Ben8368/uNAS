import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { LeftNavbar } from 'unas-src/shell/navigation/LeftNavbar'
import { AppLauncher } from 'unas-src/shell/launcher/AppLauncher'
import { WindowContainer } from 'unas-src/shell/windows/WindowContainer'
import { DesktopIcons } from 'unas-src/shell/desktop/DesktopIcons'
import { RightPanel } from 'unas-src/shell/right-panel'
import { useWindowStore } from 'unas-src/shell/windows/windowStore'
import { useSystemStore } from 'unas-src/shared/preferences/store'
import { useAppearance } from 'unas-src/shell/app/useAppearance'
import { useWorkspaceSession } from 'unas-src/shell/app/useWorkspaceSession'
import { isWorkspaceSurface } from 'unas-src/platform/workspace/surface'
import { isWorkspaceApp } from 'unas-src/platform/workspace/workspaceRouter'
import { launchStatus } from 'unas-src/platform/workspace/launchStatus'

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
    if (!workspace || !['owner', 'client'].includes(session.state)) return
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
        <DesktopIcons onOpenApp={handleOpenApp} />
        {['unavailable', 'lost'].includes(session.state) && <section className="workspace-status" role="alert"><h1>Workspace 连接已中断</h1><p>任务所有者已关闭或通信不可用。请刷新页面后重新开始；不会自动重放任务或恢复模拟文件。</p></section>}
      </div>
      <WindowContainer /><AppLauncher onOpenApp={handleOpenApp} />
      <RightPanel workspace={session.state === 'owner'} />
    </div>
  )
}
