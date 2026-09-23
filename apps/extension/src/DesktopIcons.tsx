import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'

import { getLauncherApps } from 'unas-src/appRegistry'
import { AppIconImage } from 'unas-src/components/AppIconImage'
import { APP_ICON_PATHS } from 'unas-src/icon-library'
import { openLink, readLinks, subscribeLinks, type LinkApp } from 'unas-src/runtime/linkApps'

export function DesktopIcons({ onOpenApp }: { onOpenApp: (id: string) => void }) {
  const [links, setLinks] = useState<LinkApp[]>([])
  const [rowCount, setRowCount] = useState(6)
  const gridRef = useRef<HTMLElement>(null)
  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const next = await readLinks()
        if (active) setLinks(next)
      } catch {
        if (active) setLinks([])
      }
    }
    void load()
    const unsubscribe = subscribeLinks(() => { void load() })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])
  const apps = getLauncherApps()
  const itemCount = apps.length + links.length

  useLayoutEffect(() => {
    const grid = gridRef.current
    const desktop = grid?.parentElement
    const tile = grid?.querySelector<HTMLElement>('.app-icon')
    if (!grid || !desktop || !tile || itemCount === 0) return

    const updateRows = () => {
      const rowGap = Number.parseFloat(getComputedStyle(grid).rowGap) || 0
      const tileHeight = tile.getBoundingClientRect().height
      const availableHeight = grid.clientHeight
      if (tileHeight <= 0 || availableHeight <= 0) return
      const nextRowCount = Math.min(itemCount, Math.max(1, Math.floor((availableHeight + rowGap) / (tileHeight + rowGap))))
      setRowCount((current) => current === nextRowCount ? current : nextRowCount)
    }

    const frame = requestAnimationFrame(updateRows)
    const observer = new ResizeObserver(updateRows)
    observer.observe(desktop)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [itemCount])

  return (
    <nav ref={gridRef} className="icon-grid" aria-label="应用快捷方式" style={{ '--desktop-icon-rows': rowCount } as CSSProperties}>
      {apps.map((app) => (
        <button type="button"
          key={app.id}
          className={`app-icon app-icon--${app.id}`}
          title={app.label}
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
          title={link.name}
          onClick={() => openLink(link.url)}
        >
          <AppIconImage src={APP_ICON_PATHS.browser} alt={link.name} variant="desktop" />
          <span className="app-icon-label">{link.name}</span>
        </button>
      ))}
    </nav>
  )
}
