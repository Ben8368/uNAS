import { useState } from 'react'
import { getAppIcon } from 'unas-src/icon-library'
import { IconBell, IconGear, IconGrid, IconMonitor, IconUser } from 'unas-src/LeftNavbarIcons'
import { useSystemStore } from 'unas-src/store'
import { useWindowStore } from 'unas-src/windowStore'

export function LeftNavbar() {
  const { showLauncher, toggleLauncher } = useSystemStore()
  const { windows, openWindow, minimizeWindow, focusWindow } = useWindowStore()
  const [showAccount, setShowAccount] = useState(false)
  const topZ = Math.max(0, ...windows.filter((item) => !item.isMinimized).map((item) => item.zIndex))
  function activate(appType: string) {
    const existing = windows.find((item) => item.appType === appType)
    if (!existing || existing.isMinimized) { openWindow(appType); return }
    if (existing.zIndex === topZ) minimizeWindow(existing.id)
    else focusWindow(existing.id)
  }
  return (
    <nav className="mt-left-nav" aria-label="桌面导航">
      <div className="mt-left-nav__section mt-left-nav__section--top">
        <NavButton icon={<IconMonitor />} label="显示桌面" onClick={() => windows.forEach((item) => minimizeWindow(item.id))} />
        <NavButton icon={<IconGrid />} label="所有应用" active={showLauncher} onClick={toggleLauncher} />
      </div>
      <div className="mt-left-nav__sep" />
      <div className="mt-left-nav__section mt-left-nav__section--apps">
        {windows.map((item) => <button key={item.id} type="button" title={item.title} aria-label={`切换到${item.title}`} onClick={() => activate(item.appType)}
          className={`mt-left-nav__app-btn ${item.zIndex === topZ && !item.isMinimized ? 'mt-left-nav__app-btn--active' : ''}`}><img src={getAppIcon(item.appType)} alt="" /></button>)}
      </div>
      <div className="mt-left-nav__section mt-left-nav__section--bottom">
        <NavButton icon={<IconBell />} label="演示日志" onClick={() => openWindow('logs')} />
        <NavButton icon={<IconUser />} label="账号" active={showAccount} onClick={() => setShowAccount(!showAccount)} />
        <NavButton icon={<IconGear />} label="设置" onClick={() => openWindow('settings')} />
      </div>
      {showAccount && <div className="mt-left-nav__account-menu" role="status"><p>账号服务尚未接入；当前不会读取或上传任何账号信息。</p><button type="button" className="mt-btn" onClick={() => setShowAccount(false)}>知道了</button></div>}
    </nav>
  )
}

function NavButton({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick: () => void }) {
  return <button type="button" title={label} aria-label={label} aria-pressed={active} onClick={onClick} className={`sb-btn ${active ? 'sb-btn--active' : ''}`}>{icon}</button>
}
