import { useEffect, useRef, useState } from 'react'
import { webDavConnections, type WebDavConnection } from 'unas-src/platform/webdav/connections'
const EMPTY = { name: '', endpoint: '', username: '', appPassword: '', vaultKey: '' }
export function WebDavSettings() {
  const [connections, setConnections] = useState<WebDavConnection[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [form, setForm] = useState(EMPTY)
  const [consent, setConsent] = useState(false)
  const [recoveryKey, setRecoveryKey] = useState('')
  const [busy, setBusy] = useState('load')
  const inFlight = useRef(false)
  const [status, setStatus] = useState<{ text: string; error?: boolean }>()
  useEffect(() => {
    let active = true
    void webDavConnections.list().then(items => { if (active) { setConnections(items); if (items[0]) { setSelectedId(items[0].id); setForm({ ...EMPTY, name: items[0].name, endpoint: items[0].endpoint }); setConsent(true) } } })
      .catch((error: unknown) => { if (active) setStatus({ text: errorText(error), error: true }) })
      .finally(() => { if (active) setBusy('') })
    return () => { active = false }
  }, [])
  function select(id: string) {
    const connection = connections.find(item => item.id === id)
    setSelectedId(id); setForm({ ...EMPTY, name: connection?.name ?? '', endpoint: connection?.endpoint ?? '' }); setConsent(Boolean(connection)); setStatus(undefined)
  }
  async function save() {
    if (inFlight.current || busy) return
    inFlight.current = true; setBusy('save'); setStatus(undefined)
    try {
      const result = await webDavConnections.save({ ...form, id: selectedId || undefined, consent })
      setConnections(current => [...current.filter(item => item.id !== result.connection.id), result.connection])
      setSelectedId(result.connection.id)
      setForm({ ...EMPTY, name: result.connection.name, endpoint: result.connection.endpoint })
      setRecoveryKey(result.recoveryKey ?? '')
      setStatus(result.vaultReady ? { text: '连接已保存，文件管理可直接使用，密码库已自动配置。' } : { text: 'WebDAV 连接已保存，文件管理可使用；密码库尚未就绪：' + result.vaultError, error: true })
    } catch (error) { setStatus({ text: errorText(error), error: true }) }
    finally { inFlight.current = false; setBusy('') }
  }
  async function remove() {
    if (inFlight.current || busy || !window.confirm('移除此共享连接及关联的本地密码库连接？所有 App 将停止使用它，服务器数据不会删除。')) return
    inFlight.current = true; setBusy('remove')
    try {
      await webDavConnections.remove(selectedId)
      setConnections(current => current.filter(item => item.id !== selectedId)); select('')
      setStatus({ text: '连接已移除，服务器上的文件和加密密码库未删除。' })
    } catch (error) { setStatus({ text: errorText(error), error: true }) }
    finally { inFlight.current = false; setBusy('') }
  }
  return <div className="settings-content" aria-busy={Boolean(busy)}>
    <section className="settings-card">
      <h3>项目共享连接</h3><p>配置一次，文件管理与密码管家共用。其他 App 可通过统一 WebDAV 服务接入。</p>
      <label className="settings-field">选择连接<select value={selectedId} disabled={Boolean(busy) || Boolean(recoveryKey)} onChange={event => select(event.target.value)}>
        <option value="">添加 WebDAV 连接</option>{connections.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      {busy === 'load' && <p role="status">正在读取连接…</p>}
    </section>
    <section className="settings-card">
      <h3>{selectedId ? '管理 WebDAV 连接' : '连接 WebDAV'}</h3>
      <form onSubmit={event => { event.preventDefault(); void save() }}>
        <fieldset className="settings-form" disabled={Boolean(busy) || Boolean(recoveryKey)}>
          <label className="settings-field">WebDAV 地址<input type="url" required readOnly={Boolean(selectedId)} value={form.endpoint} placeholder="https://nas.example/dav/" onChange={event => setForm({ ...form, endpoint: event.target.value })} /></label>
          <div className="settings-grid">
            <label className="settings-field">用户名<input required={!selectedId} autoComplete="username" value={form.username} placeholder={selectedId ? '留空保留已保存账号' : 'WebDAV 用户名'} onChange={event => setForm({ ...form, username: event.target.value })} /></label>
            <label className="settings-field">应用密码（App Password）<input required={!selectedId} type="password" autoComplete="off" value={form.appPassword} placeholder={selectedId ? '留空保留已保存密码' : '服务器应用密码'} onChange={event => setForm({ ...form, appPassword: event.target.value })} /></label>
          </div>
          <details className="settings-advanced"><summary>高级选项与密码库恢复</summary>
            <label className="settings-field">连接名称<input value={form.name} placeholder="默认使用服务器名称" onChange={event => setForm({ ...form, name: event.target.value })} /></label>
            <label className="settings-field">已有 Vault Key（可选）<input type="password" autoComplete="off" value={form.vaultKey} onChange={event => setForm({ ...form, vaultKey: event.target.value })} /></label>
            <p>首次连接会自动创建加密密码库；已有远端密码库需填写恢复密钥，绝不覆盖已有数据。旧连接保留原目录。</p>
          </details>
          <label className="settings-consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /><span>在本机加密保存认证信息，供 uNAS 共用，并自动配置、同步加密密码库。普通文件仅在我点击上传时发送。</span></label>
          <div className="settings-actions"><button type="submit" className="mt-btn mt-btn--primary" disabled={!consent}>{busy === 'save' ? '保存中…' : selectedId ? '更新连接' : '保存连接'}</button>{selectedId && <button type="button" className="mt-btn mt-btn--danger" onClick={() => void remove()}>移除连接</button>}</div>
        </fieldset>
      </form>
    </section>
    {recoveryKey && <section className="settings-card"><h3>请安全保存 Vault Key</h3><p>密码库已自动配置。此密钥用于其他设备恢复密码库，关闭窗口后将不再显示。</p><label className="settings-field">Vault Key<input readOnly value={recoveryKey} /></label><button type="button" className="mt-btn" onClick={() => setRecoveryKey('')}>已安全保存密钥</button></section>}
    {status && <p className={'settings-status ' + (status.error ? 'is-error' : '')} role={status.error ? 'alert' : 'status'}>{status.text}</p>}
  </div>
}
function errorText(error: unknown) { return error instanceof Error ? error.message : '操作失败，请重试。' }
