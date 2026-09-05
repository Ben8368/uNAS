import { useEffect, useState } from 'react'

import { getLauncherApps } from 'unas-src/appRegistry'
import { AppIconImage } from 'unas-src/components/AppIconImage'
import { APP_ICON_PATHS } from 'unas-src/icon-library'
import { openLink, readLinks, subscribeLinks, type LinkApp } from 'unas-src/runtime/linkApps'

function readDesktopLinks(): LinkApp[] {
  try { return readLinks() } catch { return [] }
}

export function DesktopIcons({ onOpenApp }: { onOpenApp: (id: string) => void }) {
  const [links, setLinks] = useState<LinkApp[]>(readDesktopLinks)
  useEffect(() => subscribeLinks(() => setLinks(readDesktopLinks())), [])
  const apps = getLauncherApps()
  return (
    <nav className="icon-grid" aria-label="应用快捷方式">
      {apps.map((app) => (
        <button type="button"
          key={app.id}
          className={`app-icon app-icon--${app.id}`}
          onClick={() => onOpenApp(app.id)}
        >
          <AppIconImage src={app.icon} alt={app.label} variant="desktop" />
          <span className="app-icon-label">{app.label}</span>
        </button>
      ))}
      {links.map((link) => (
        <button type="button"
          key={link.id}
          className={`app-icon app-icon--${link.id}`}
          onClick={() => openLink(link.url)}
        >
          <AppIconImage src={APP_ICON_PATHS.browser} alt={link.name} variant="desktop" />
          <span className="app-icon-label">{link.name}</span>
        </button>
      ))}
    </nav>
  )
}
