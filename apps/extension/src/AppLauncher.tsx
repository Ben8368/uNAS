import { useLayoutEffect, useRef, useState } from 'react'
import { getLauncherApps } from 'unas-src/appRegistry'
import { AppIconImage } from 'unas-src/components/AppIconImage'
import { useSystemStore } from 'unas-src/store'

export function AppLauncher({ onOpenApp }: { onOpenApp: (id: string) => void }) {
  const { showLauncher, setShowLauncher } = useSystemStore()
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeLauncher = () => dialogRef.current?.close()

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (showLauncher && !dialog.open) {
      setSearch('')
      dialog.showModal()
      inputRef.current?.focus()
    }
    if (!showLauncher && dialog.open) dialog.close()
  }, [showLauncher])

  const filtered = getLauncherApps().filter((app) => app.label.includes(search) || app.title.includes(search))

  return (
    <dialog
      ref={dialogRef}
      className="mt-launcher"
      aria-label="应用启动器"
      onClose={() => setShowLauncher(false)}
      onClick={(event) => { if (event.target === event.currentTarget) closeLauncher() }}
    >
        <div className="mt-launcher-search">
          <input ref={inputRef} type="text" aria-label="搜索应用" placeholder="搜索..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="mt-launcher-grid">
          <div className="mt-launcher-apps">
            {filtered.map((app) => (
              <button type="button"
                key={app.id}
                className="launcher-app"
                onClick={() => { onOpenApp(app.id); closeLauncher() }}
              >
                <AppIconImage src={app.icon} alt={app.label} variant="launcher" />
                <span className="launcher-app-name">{app.label}</span>
              </button>
            ))}
          </div>
        </div>
    </dialog>
  )
}
