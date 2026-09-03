import { useCallback, useEffect } from 'react'
import { LeftNavbar } from 'unas-src/LeftNavbar'
import { AppLauncher } from 'unas-src/AppLauncher'
import { WindowContainer } from 'unas-src/WindowContainer'
import { DesktopIcons } from 'unas-src/DesktopIcons'
import { RightPanel } from 'unas-src/components/RightPanel'
import { useWindowStore } from 'unas-src/windowStore'
import { useSystemStore } from 'unas-src/store'

export default function App() {
  const { openWindow } = useWindowStore()
  const { setShowLauncher, wallpaper } = useSystemStore()

  const handleOpenApp = useCallback((id: string) => {
    openWindow(id)
    setShowLauncher(false)
  }, [openWindow, setShowLauncher])

  useEffect(() => {
    document.documentElement.style.setProperty('--mt-wp', `url('/static/bg/live/wallpaper-${wallpaper + 1}-dark.webp')`)
  }, [wallpaper])

  return (
    <div className="mt-desktop">
      <LeftNavbar />
      <div className="mt-main">
        <DesktopIcons onOpenApp={handleOpenApp} />
      </div>
      <WindowContainer />
      <AppLauncher onOpenApp={handleOpenApp} />
      <RightPanel />
    </div>
  )
}
