import { useEffect, useRef, useState } from 'react'
import { getLauncherApps } from 'unas-src/appRegistry'
import { AppIconImage } from 'unas-src/components/AppIconImage'
import { useSystemStore } from 'unas-src/store'

export function AppLauncher({ onOpenApp }: { onOpenApp: (id: string) => void }) {
  const { showLauncher, setShowLauncher } = useSystemStore()
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showLauncher) return
    const previous = document.activeElement as HTMLElement | null
    const overlay = overlayRef.current
    const siblings = Array.from(overlay?.parentElement?.children || []).filter((element) => element !== overlay) as HTMLElement[]
    const prior = siblings.map((element) => element.inert)
    siblings.forEach((element) => { element.inert = true })
    inputRef.current?.focus()
    return () => { siblings.forEach((element, index) => { element.inert = prior[index] }); previous?.focus() }
  }, [showLauncher])
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!showLauncher) return
      if (e.key === 'Escape') { e.stopPropagation(); setShowLauncher(false) }
      if (e.key === 'Tab') {
        const controls = Array.from(overlayRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, [tabindex="0"]') || [])
        const first = controls[0]; const last = controls[controls.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
      }
    }
    window.addEventListener('keydown', h, true)
    return () => window.removeEventListener('keydown', h, true)
  }, [setShowLauncher, showLauncher])

  if (!showLauncher) return null

  const filtered = getLauncherApps().filter((app) => app.label.includes(search) || app.title.includes(search))

  return (
    <div ref={overlayRef} className="mt-launcher-overlay" onClick={() => setShowLauncher(false)}>
      <div className="mt-launcher" role="dialog" aria-modal="true" aria-label="应用启动器" onClick={(e) => e.stopPropagation()}>
        <div className="mt-launcher-search">
          <input ref={inputRef} type="text" aria-label="搜索应用" placeholder="搜索..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="mt-launcher-grid">
          <div className="mt-launcher-apps">
            {filtered.map((app) => (
              <button type="button"
                key={app.id}
                className="launcher-app"
                onClick={() => { onOpenApp(app.id); setShowLauncher(false) }}
              >
                <AppIconImage src={app.icon} alt={app.label} variant="launcher" />
                <span className="launcher-app-name">{app.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
