import { useEffect, useState } from 'react'
import { normalizeWebDavUrl } from 'unas-src/shared/webdav-url'
import { send } from 'unas-src/modules/password-manager/popup/bridge'
import type { VaultConnection, VaultProfile } from 'unas-src/modules/password-manager/shared/vault'

const EMPTY_CONNECTION = { name: '', endpoint: '', username: '', appPassword: '', vaultKey: '' }

export function WebDavSettings() {
  const [profiles, setProfiles] = useState<VaultProfile[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [form, setForm] = useState(EMPTY_CONNECTION)
  const [recoveryKey, setRecoveryKey] = useState('')
  const [busy, setBusy] = useState('load')
  const [status, setStatus] = useState<{ text: string; error?: boolean }>()

  useEffect(() => {
    let active = true
    void send<VaultProfile[]>({ type: 'listVaultProfiles' }).then((items) => {
      if (active) setProfiles(items)
    }).catch((reason: unknown) => {
      if (active) setStatus({ text: errorText(reason), error: true })
    }).finally(() => { if (active) setBusy('') })
    return () => { active = false }
  }, [])

  function selectConnection(id: string) {
    const profile = profiles.find((item) => item.id === id)
    setSelectedId(id)
    setForm({ ...EMPTY_CONNECTION, name: profile?.name ?? '', endpoint: profile?.endpoint ?? '' })
    setStatus(undefined)
  }

  async function run(action: string, operation: () => Promise<void>) {
    if (busy) return
    setBusy(action)
    setStatus(undefined)
    try { await operation() }
    catch (reason) { setStatus({ text: errorText(reason), error: true }) }
    finally { setBusy('') }
  }

  function connectionInput() {
    const endpoint = normalizeWebDavUrl(form.endpoint)
    return {
      mode: selectedId ? 'reconnect' as const : form.vaultKey.trim() ? 'existing' as const : 'create' as const,
      vaultId: selectedId || undefined,
      name: form.name.trim() || new URL(endpoint).hostname,
      endpoint,
      username: form.username.trim(),
      appPassword: form.appPassword,
      vaultKey: form.vaultKey.trim() || undefined,
    }
  }

  async function saveConnection() {
    await run('save', async () => {
      const connection = await send<VaultConnection>({ type: 'saveWebDavVault', ...connectionInput() })
      setProfiles((current) => [...current.filter((item) => item.id !== connection.profile.id), connection.profile])
      setSelectedId(connection.profile.id)
      setForm({ ...EMPTY_CONNECTION, name: connection.profile.name, endpoint: connection.profile.endpoint ?? '' })
      if (connection.recoveryKey) setRecoveryKey(connection.recoveryKey)
      setStatus({ text: connection.recoveryKey ? '密码库已连接。请先安全保存 Vault Key，再返回密码管家刷新。' : '连接已保存。返回密码管家后点击刷新即可使用。' })
    })
  }

  async function removeConnection() {
    const profile = profiles.find((item) => item.id === selectedId)
    if (!profile || !window.confirm(`移除“${profile.name}”的连接吗？服务器上的加密数据不会被删除。`)) return
    await run('remove', async () => {
      await send<void>({ type: 'removeVault', vaultId: profile.id })
      setProfiles((current) => current.filter((item) => item.id !== profile.id))
      selectConnection('')
      setStatus({ text: '连接已移除，服务器上的加密数据未删除。返回密码管家后请刷新。' })
    })
  }

  return <div className="settings-content" aria-busy={Boolean(busy)}>
    <section className="settings-card">
      <h3>密码库连接</h3>
      <p>连接 WebDAV 上的加密密码库。网站和登录账号在密码管家中管理。</p>
      <label className="settings-field">选择连接
        <select value={selectedId} disabled={Boolean(busy) || Boolean(recoveryKey)} onChange={(event) => selectConnection(event.target.value)}>
          <option value="">新建连接</option>
          {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
        </select>
      </label>
      {busy === 'load' && <p role="status">正在读取连接…</p>}
    </section>
    <section className="settings-card">
      <h3>{selectedId ? '重新连接 WebDAV' : '连接 WebDAV'}</h3>
      <p>应用密码和 Vault Key 仅保留在当前表单中；保存成功后清空输入。</p>
      <form onSubmit={(event) => { event.preventDefault(); void saveConnection() }}>
        <fieldset className="settings-form" disabled={Boolean(busy) || Boolean(recoveryKey)}>
          <div className="settings-grid">
            <label className="settings-field">密码库名称<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} autoComplete="off" placeholder="例如：我的 NAS 密码库" /></label>
            <label className="settings-field">WebDAV 地址<input required value={form.endpoint} onChange={(event) => setForm({ ...form, endpoint: event.target.value })} inputMode="url" autoComplete="off" placeholder="https://nas.example.com/dav/" /></label>
            <label className="settings-field">WebDAV 用户名<input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} autoComplete="username" /></label>
            <label className="settings-field">应用密码（App Password）<input type="password" value={form.appPassword} onChange={(event) => setForm({ ...form, appPassword: event.target.value })} autoComplete="new-password" /></label>
          </div>
          <label className="settings-field">Vault Key（接入已有库时填写）<input type="password" value={form.vaultKey} onChange={(event) => setForm({ ...form, vaultKey: event.target.value })} autoComplete="off" aria-describedby="settings-vault-key-help" /></label>
          <p id="settings-vault-key-help">{selectedId ? '已有连接可留空；迁移设备或恢复本地数据时再填写。' : '留空将新建密码库；填写已有 Vault Key 将连接远端密码库。'}</p>
          <div className="settings-actions">
            <button type="button" className="mt-btn" onClick={() => void run('test', async () => {
              await send<void>({ type: 'testWebDavConnection', ...connectionInput() })
              setStatus({ text: 'WebDAV 连接和目录权限检查通过。' })
            })}>{busy === 'test' ? '测试中…' : '测试连接'}</button>
            <button type="submit" className="mt-btn mt-btn--primary">{busy === 'save' ? '连接中…' : selectedId ? '重新连接' : '保存连接'}</button>
            {selectedId && <button type="button" className="mt-btn mt-btn--danger" onClick={() => void removeConnection()}>{busy === 'remove' ? '移除中…' : '移除连接'}</button>}
          </div>
        </fieldset>
      </form>
    </section>
    {recoveryKey && <section className="settings-card">
      <h3>请安全保存 Vault Key</h3>
      <p>此密钥用于在其他设备连接或恢复密码库。关闭设置窗口后将不再显示。</p>
      <label className="settings-field">Vault Key<input readOnly value={recoveryKey} /></label>
      <div className="settings-actions"><button type="button" className="mt-btn" onClick={() => setRecoveryKey('')}>已安全保存密钥</button></div>
    </section>}
    {status && <p className={`settings-status ${status.error ? 'is-error' : ''}`} role={status.error ? 'alert' : 'status'}>{status.text}</p>}
  </div>
}

function errorText(reason: unknown): string {
  return reason instanceof Error ? reason.message : '操作失败，请重试。'
}
