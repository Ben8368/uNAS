import { useEffect, useState } from 'react'
import { openPasswordManager, readPasswordManagerProfiles, type PasswordManagerProfile } from 'unas-src/runtime/passwordManager'
import 'unas-src/modules/password-manager/ui.css'

export function PasswordManagerApp() {
  const [profiles, setProfiles] = useState<PasswordManagerProfile[]>([])
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    void readPasswordManagerProfiles().then((next) => { if (active) setProfiles(next) }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : '无法读取密码库状态。')
    })
    return () => { active = false }
  }, [])

  async function manage() {
    setBusy(true)
    setError(undefined)
    try { await openPasswordManager() } catch (reason) { setError(reason instanceof Error ? reason.message : '无法打开密码管家管理页。') } finally { setBusy(false) }
  }

  return <main className="password-manager-app" aria-label="密码管家">
    <header className="password-manager-app__header">
      <div><p className="password-manager-app__eyebrow">uNAS · LOCAL VAULT</p><h2>密码管家</h2><p>管理 WebDAV 加密密码库；网页填充继续使用工具栏中的密码浮窗。</p></div>
      <span className="password-manager-app__badge">{profiles.length ? `${profiles.length} 个密码库` : '未配置'}</span>
    </header>
    <section className="password-manager-app__card">
      <h3>桌面入口</h3>
      <p>{profiles.length ? '密码库配置保存在本机受保护存储中，明文密码不会进入桌面状态。' : '还没有配置密码库。你可以从管理页连接已有 WebDAV Vault，或创建新的加密密码库。'}</p>
      {profiles.length > 0 && <ul>{profiles.map((profile) => <li key={profile.id}>{profile.name || '未命名密码库'}</li>)}</ul>}
      {error && <p className="password-manager-app__error" role="alert">{error}</p>}
      <button type="button" className="mt-btn mt-btn--primary" onClick={() => void manage()} disabled={busy}>{busy ? '正在打开…' : '打开密码管家管理页'}</button>
    </section>
    <p className="password-manager-app__note">网页浮窗外观和 Shadow DOM 结构保持原样；此桌面入口只复用同一个 Vault Core。</p>
  </main>
}
