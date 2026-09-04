import { getLauncherApps } from 'unas-src/appRegistry'
import { AppIconImage } from 'unas-src/components/AppIconImage'

export function DesktopIcons({ onOpenApp }: { onOpenApp: (id: string) => void }) {
  return (
    <nav className="icon-grid" aria-label="应用快捷方式">
      {getLauncherApps().map((app) => (
        <button type="button"
          key={app.id}
          className={`app-icon app-icon--${app.id}`}
          onClick={() => onOpenApp(app.id)}
        >
          <AppIconImage src={app.icon} alt={app.label} variant="desktop" />
          <span className="app-icon-label">{app.label}</span>
        </button>
      ))}
    </nav>
  )
}
