import { WALLPAPERS } from 'unas-src/appearance'
import { useSystemStore } from 'unas-src/store'

export function SettingsApp() {
  const state = useSystemStore()
  return (
    <div className="settings-app settings-app--single">
      <main className="settings-panel">
        <div className="settings-toolbar"><div><h2>外观与辅助功能</h2></div></div>
        <div className="settings-content">
          <section className="settings-card">
            <h3>主题与背景</h3>
            <label className="settings-field"><span>主题</span>
              <select aria-label="主题" value={state.themeMode} onChange={(event) => state.setThemeMode(event.target.value as typeof state.themeMode)}>
                <option value="system">跟随系统</option><option value="dark">深色</option><option value="light">浅色</option>
              </select>
            </label>
            <div className="settings-wallpapers" role="group" aria-label="原创背景">
              {WALLPAPERS.map((item, index) => <button key={item.name} type="button" aria-label={item.name} aria-pressed={state.wallpaper === index}
                className={`settings-wallpaper ${state.wallpaper === index ? 'settings-wallpaper--active' : ''}`}
                style={{ backgroundImage: item.gradientSrgb }} onClick={() => state.setWallpaper(index)}><span>{item.name}</span></button>)}
              </div>
          </section>
          <p role="status">{state.preferenceNotice}</p>
        </div>
      </main>
    </div>
  )
}
