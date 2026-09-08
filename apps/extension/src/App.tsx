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
import { fileWorkspacePort } from 'unas-src/api/fileWorkspace'
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
  useEffect(() => { void fileWorkspacePort.restoreDirectory() }, [])

  const handleOpenApp = useCallback((id: string) => {
    if (id === 'file-manager') {
      // The picker is invoked while the launch click is still a trusted user gesture.
      if (fileWorkspacePort.getSnapshot().status === 'ready') void fileWorkspacePort.restoreDirectory()
      else void fileWorkspacePort.chooseDirectory()
    }
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
