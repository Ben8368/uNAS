import { WALLPAPERS } from 'unas-src/appearance'
import { useSystemStore } from 'unas-src/store'

export function SettingsApp() {
  const state = useSystemStore()
  return (
    <div className="settings-app settings-app--single">
      <main className="settings-panel">
        <div className="settings-toolbar"><div><h2>外观与辅助功能</h2><p>当前为模拟演示。设置只改变本地界面，不授权文件或连接服务。</p></div></div>
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
                style={{ backgroundImage: item.gradient }} onClick={() => state.setWallpaper(index)}><span>{item.name}</span></button>)}
            </div>
            <p>背景由本地 CSS 生成，无远程图片或高分辨率位图。</p>
          </section>
          <section className="settings-card">
            <h3>可读性与动态效果</h3>
            {([
              ['reduceMotion', '减少动态效果'], ['reduceTransparency', '减少透明度'], ['highContrast', '提高对比度'],
            ] as const).map(([key, label]) => <label className="settings-toggle" key={key}><input type="checkbox" checked={state[key]} onChange={(event) => state.setAccessibility(key, event.target.checked)} />{label}</label>)}
            <p>同时尊重系统的减少动态、减少透明度和对比度偏好。</p>
          </section>
          <section className="settings-card"><h3>键盘操作</h3><p>Tab 移动焦点，Enter 启动应用，Alt + F6 切换窗口，Alt + Shift + W 关闭当前应用，Escape 退出弹层。文件操作提供按钮与键盘路径。</p></section>
          <p role="status">{state.preferenceNotice}</p>
        </div>
      </main>
    </div>
  )
}
