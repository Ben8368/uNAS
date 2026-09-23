import { useEffect, useState } from 'react'
import { RefreshCw, ShieldCheck } from 'lucide-react'
import { normalizeWebDavUrl } from 'unas-src/shared/webdav-url'
import type { VaultAccount, VaultApp, VaultConnection, VaultProfile } from 'unas-src/modules/password-manager/shared/vault'
import type { VaultSyncStatusResult } from 'unas-src/modules/password-manager/shared/types'
import { send } from 'unas-src/modules/password-manager/popup/bridge'
import 'unas-src/modules/password-manager/ui.css'

type CatalogEntry = { app: VaultApp; accounts: VaultAccount[] }
type ManagerStatus = { text: string; error?: boolean }

const EMPTY_VAULT = { name: '', endpoint: '', username: '', appPassword: '', vaultKey: '' }
const EMPTY_APP = { id: '', name: '', host: '', path: '' }
const EMPTY_ACCOUNT = { id: '', appId: '', username: '', remark: '', password: '' }

export function PasswordManagerApp() {
  const [profiles, setProfiles] = useState<VaultProfile[]>([])
  const [selectedVaultId, setSelectedVaultId] = useState('')
  const [catalog, setCatalog] = useState<CatalogEntry[]>([])
  const [syncStatuses, setSyncStatuses] = useState<VaultSyncStatusResult[]>([])
  const [vault, setVault] = useState(EMPTY_VAULT)
  const [app, setApp] = useState(EMPTY_APP)
  const [account, setAccount] = useState(EMPTY_ACCOUNT)
  const [recoveryKey, setRecoveryKey] = useState('')
  const [status, setStatus] = useState<ManagerStatus>()
  const [busy, setBusy] = useState<string | undefined>()

  async function load(preferredVaultId = selectedVaultId): Promise<void> {
    try {
      const nextProfiles = await send<VaultProfile[]>({ type: 'listVaultProfiles' })
      const nextVaultId = nextProfiles.some((profile) => profile.id === preferredVaultId)
        ? preferredVaultId
        : nextProfiles[0]?.id ?? ''
      const [nextCatalog, nextSyncStatuses] = await Promise.all([
        nextVaultId ? send<{ entries: CatalogEntry[]; failures: Array<{ vaultId: string; error: string }> }>({ type: 'vaultCatalog' }) : Promise.resolve({ entries: [], failures: [] }),
        nextProfiles.length ? send<VaultSyncStatusResult[]>({ type: 'listVaultSyncStatuses' }) : Promise.resolve([]),
      ])
      const failures = nextCatalog.failures.filter((failure) => failure.vaultId === nextVaultId)
      setProfiles(nextProfiles)
      setSelectedVaultId(nextVaultId)
      setCatalog(nextCatalog.entries.filter((entry) => entry.app.vaultId === nextVaultId))
      setSyncStatuses(nextSyncStatuses)
      const selected = nextProfiles.find((profile) => profile.id === nextVaultId)
      if (selected) setVault((current) => ({ ...current, name: selected.name, endpoint: selected.endpoint ?? '', username: '', appPassword: '', vaultKey: '' }))
      if (failures.length) setStatus({ text: failures.map((failure) => failure.error).join('；'), error: true })
    } catch (reason) {
      setStatus({ text: errorText(reason), error: true })
    }
  }

  useEffect(() => {
    void load('')
    return () => {
      // Secret form values are component-local and are cleared on unmount;
      // they never enter Zustand, BroadcastChannel, or persistent storage.
      setVault(EMPTY_VAULT)
      setAccount(EMPTY_ACCOUNT)
      setRecoveryKey('')
    }
  }, [])

  async function run(label: string, operation: () => Promise<void>, clearSecrets = false): Promise<void> {
    if (busy) return
    setBusy(label)
    setStatus(undefined)
    try {
      await operation()
      if (clearSecrets) {
        setVault((current) => ({ ...current, appPassword: '', vaultKey: '' }))
        setAccount((current) => ({ ...current, password: '' }))
      }
    } catch (reason) {
      setStatus({ text: errorText(reason), error: true })
    } finally {
      setBusy(undefined)
    }
  }

  const selectedProfile = profiles.find((profile) => profile.id === selectedVaultId)
  const selectedSync = syncStatuses.find((item) => item.vaultId === selectedVaultId)
  const canEdit = Boolean(selectedVaultId)

  async function testVault(): Promise<void> {
    await run('test', async () => {
      await send<void>({ type: 'testWebDavConnection', ...vaultInput(vault, selectedVaultId) })
      setStatus({ text: 'WebDAV 连接和目录权限检查通过' })
    })
  }

  async function saveVault(): Promise<void> {
    await run('vault', async () => {
      const connection = await send<VaultConnection>({ type: 'saveWebDavVault', ...vaultInput(vault, selectedVaultId) })
      setSelectedVaultId(connection.profile.id)
      if (connection.recoveryKey) setRecoveryKey(connection.recoveryKey)
      setStatus({ text: connection.recoveryKey ? '密码库已保存并连接，请立即保存下方 Vault Key。' : 'WebDAV 密码库已保存并连接。' })
      await load(connection.profile.id)
    }, true)
  }

  async function syncVaults(): Promise<void> {
    await run('sync', async () => {
      await send<void>({ type: 'syncVaults' })
      await load(selectedVaultId)
      setStatus({ text: '密码库同步检查完成；冲突和离线状态已保留。' })
    })
  }

  async function removeVault(): Promise<void> {
    if (!selectedProfile || !window.confirm(`删除“${selectedProfile.name}”吗？这只会移除扩展中的连接信息，不会删除 WebDAV 服务器上的加密数据。`)) return
    await run('remove', async () => {
      await send<void>({ type: 'removeVault', vaultId: selectedProfile.id })
      setVault(EMPTY_VAULT)
      setRecoveryKey('')
      setStatus({ text: '密码库已从扩展中移除；WebDAV 服务器上的加密数据未删除。' })
      await load('')
    }, true)
  }

  async function saveApp(): Promise<void> {
    if (!selectedVaultId) return setStatus({ text: '请先保存 WebDAV 密码库。', error: true })
    await run('app', async () => {
      const next = { id: app.id, vaultId: selectedVaultId, name: app.name.trim(), targets: [{ scheme: 'https' as const, host: app.host.trim(), pathPrefix: app.path.trim() || undefined }] }
      if (app.id) await send<VaultApp>({ type: 'updateVaultApp', vaultId: selectedVaultId, app: next })
      else await send<VaultApp>({ type: 'createVaultApp', vaultId: selectedVaultId, app: { name: next.name, targets: next.targets } })
      setApp(EMPTY_APP)
      setStatus({ text: '网站已保存。' })
      await load(selectedVaultId)
    })
  }

  async function saveAccount(): Promise<void> {
    if (!selectedVaultId) return setStatus({ text: '请先保存 WebDAV 密码库。', error: true })
    await run('account', async () => {
      if (!account.id) {
        if (!account.password) throw new Error('新增账号必须填写密码')
        await send<VaultAccount>({ type: 'createVaultAccount', vaultId: selectedVaultId, account: { appId: account.appId, username: account.username.trim(), remark: account.remark.trim() || undefined, password: account.password } })
      } else {
        const existing = catalog.flatMap((entry) => entry.accounts).find((item) => item.id === account.id)
        if (!existing) throw new Error('账号不存在')
        await send<VaultAccount>({ type: 'updateVaultAccount', vaultId: selectedVaultId, account: { id: account.id, appId: account.appId, username: account.username.trim(), remark: account.remark.trim() || undefined } })
        if (account.password) await send<void>({ type: 'updateVaultCredential', vaultId: selectedVaultId, accountId: account.id, credential: { password: account.password } })
      }
      setAccount(EMPTY_ACCOUNT)
      setStatus({ text: '账号和凭据已保存。' })
      await load(selectedVaultId)
    }, true)
  }

  async function deleteApp(): Promise<void> {
    if (!app.id) return
    await run('delete-app', async () => {
      await send<void>({ type: 'deleteVaultApp', vaultId: selectedVaultId, appId: app.id })
      setApp(EMPTY_APP)
      await load(selectedVaultId)
      setStatus({ text: '网站已删除。' })
    })
  }

  async function deleteAccount(): Promise<void> {
    if (!account.id) return
    await run('delete-account', async () => {
      await send<void>({ type: 'deleteVaultAccount', vaultId: selectedVaultId, accountId: account.id })
      setAccount(EMPTY_ACCOUNT)
      await load(selectedVaultId)
      setStatus({ text: '账号已删除。' })
    }, true)
  }

  return <main className="password-manager-app" aria-label="密码管家">
    <header className="password-manager-app__header">
      <div><p className="password-manager-app__eyebrow">uNAS · LOCAL VAULT</p><h2>密码管家</h2><p>在当前 Desktop 窗口管理 WebDAV 加密密码库、网站和登录账号；网页填充继续使用原密码浮窗。</p></div>
      <div className="password-manager-app__header-actions"><button type="button" className="mt-btn" onClick={() => void load(selectedVaultId)} disabled={Boolean(busy)}><RefreshCw size={16} aria-hidden="true" />刷新</button><span className="password-manager-app__badge">{profiles.length ? `${profiles.length} 个密码库` : '未配置'}</span></div>
    </header>

    <section className="password-manager-app__status-card" aria-label="密码库状态"><div><ShieldCheck size={18} aria-hidden="true" /><strong>{selectedProfile ? selectedProfile.name : '尚未配置密码库'}</strong><span>{selectedSync ? syncText(selectedSync) : '保存密码库后显示同步状态'}</span></div><button type="button" className="mt-btn" onClick={() => void syncVaults()} disabled={!profiles.length || Boolean(busy)}>{busy === 'sync' ? '同步中…' : '检查同步'}</button></section>

    {profiles.length > 0 && <section className="password-manager-app__card"><h3>已配置密码库</h3><div className="password-manager-app__list">{profiles.map((profile) => <button key={profile.id} type="button" className={`password-manager-app__list-row ${profile.id === selectedVaultId ? 'is-selected' : ''}`} onClick={() => void load(profile.id)}><span><strong>{profile.name}</strong><small>{profile.endpoint}</small></span><span>{profile.id === selectedVaultId ? '当前' : '选择'}</span></button>)}</div></section>}

    <section className="password-manager-app__card"><div className="password-manager-app__section-heading"><span>第 1 步</span><div><h3>连接 WebDAV</h3><p>连接已有加密密码库或创建新的保存位置。App Password 和 Vault Key 只在本次操作中留在受控表单状态。</p></div></div><form className="password-manager-app__form" onSubmit={(event) => { event.preventDefault(); void saveVault() }}>
      <label>密码库名称<input required value={vault.name} onChange={(event) => setVault({ ...vault, name: event.target.value })} autoComplete="off" placeholder="例如：我的 NAS 密码库" /></label><label>WebDAV 地址<input required value={vault.endpoint} onChange={(event) => setVault({ ...vault, endpoint: event.target.value })} inputMode="url" placeholder="https://nas.example.com/dav/" autoComplete="off" /></label><label>WebDAV 用户名<input value={vault.username} onChange={(event) => setVault({ ...vault, username: event.target.value })} autoComplete="username" /></label><label>应用密码（App Password）<input type="password" value={vault.appPassword} onChange={(event) => setVault({ ...vault, appPassword: event.target.value })} autoComplete="new-password" /></label><label>Vault Key（接入已有库时填写）<input type="password" value={vault.vaultKey} onChange={(event) => setVault({ ...vault, vaultKey: event.target.value })} autoComplete="off" /><small>{selectedVaultId ? '已有连接可留空；迁移设备或恢复本地数据时再填写。' : '留空将新建密码库；填写已有 Vault Key 将连接远端密码库。'}</small></label>
      {recoveryKey && <div className="password-manager-app__recovery"><strong>请立即安全保存 Vault Key</strong><input readOnly value={recoveryKey} aria-label="Vault Key" /></div>}<div className="password-manager-app__actions"><button type="button" className="mt-btn" onClick={() => void testVault()} disabled={Boolean(busy)}>{busy === 'test' ? '测试中…' : '仅测试'}</button><button type="submit" className="mt-btn mt-btn--primary" disabled={Boolean(busy)}>{busy === 'vault' ? '连接中…' : selectedVaultId ? '重新连接' : '保存并继续'}</button><button type="button" className="mt-btn mt-btn--danger" onClick={() => void removeVault()} disabled={!selectedVaultId || Boolean(busy)}>删除密码库</button></div>
    </form></section>

    <section className="password-manager-app__card"><div className="password-manager-app__section-heading"><span>第 2 步</span><div><h3>添加网站</h3><p>只填写登录网站的 HTTPS 域名和可选路径，密码管家据此匹配网页。</p></div></div><form className="password-manager-app__form" onSubmit={(event) => { event.preventDefault(); void saveApp() }}>
      <label>网站名称<input required disabled={!canEdit} value={app.name} onChange={(event) => setApp({ ...app, name: event.target.value })} placeholder="例如：公司邮箱" /></label><label>HTTPS 主机<input required disabled={!canEdit} value={app.host} onChange={(event) => setApp({ ...app, host: event.target.value })} placeholder="example.com" /></label><label>路径前缀（可选）<input disabled={!canEdit} value={app.path} onChange={(event) => setApp({ ...app, path: event.target.value })} placeholder="/login" /></label><div className="password-manager-app__actions"><button type="submit" className="mt-btn mt-btn--primary" disabled={!canEdit || Boolean(busy)}>{busy === 'app' ? '保存中…' : '保存网站'}</button><button type="button" className="mt-btn mt-btn--danger" onClick={() => void deleteApp()} disabled={!app.id || Boolean(busy)}>删除网站</button></div>
    </form>{!catalog.length && <p className="password-manager-app__empty">{canEdit ? '还没有添加网站，请先填写上面的表单。' : '保存第 1 步的密码库后，就可以在这里添加第一个网站。'}</p>}{!!catalog.length && <div className="password-manager-app__list">{catalog.map((entry) => <button key={entry.app.id} type="button" className="password-manager-app__list-row" onClick={() => selectApp(entry)}><span><strong>{entry.app.name}</strong><small>{targetUrl(entry.app)}</small></span><span>{entry.accounts.length} 个账号</span></button>)}</div>}</section>

    <section className="password-manager-app__card"><div className="password-manager-app__section-heading"><span>第 3 步</span><div><h3>保存账号</h3><p>一个网站可以有多个账号；修改已有账号时，密码留空即可保留原密码。</p></div></div><form className="password-manager-app__form" onSubmit={(event) => { event.preventDefault(); void saveAccount() }}>
      <label>选择网站<select required disabled={!canEdit} value={account.appId} onChange={(event) => setAccount({ ...account, appId: event.target.value })}><option value="">请选择</option>{catalog.map((entry) => <option key={entry.app.id} value={entry.app.id}>{entry.app.name}</option>)}</select></label><label>登录账号<input required disabled={!canEdit} value={account.username} onChange={(event) => setAccount({ ...account, username: event.target.value })} autoComplete="username" /></label><label>备注（可选）<input disabled={!canEdit} value={account.remark} onChange={(event) => setAccount({ ...account, remark: event.target.value })} autoComplete="off" /></label><label>登录密码<input type="password" disabled={!canEdit} value={account.password} onChange={(event) => setAccount({ ...account, password: event.target.value })} autoComplete="new-password" /><small>新增账号必填；修改已有账号时留空。</small></label><div className="password-manager-app__actions"><button type="submit" className="mt-btn mt-btn--primary" disabled={!canEdit || Boolean(busy)}>{busy === 'account' ? '保存中…' : '保存账号'}</button><button type="button" className="mt-btn mt-btn--danger" onClick={() => void deleteAccount()} disabled={!account.id || Boolean(busy)}>删除账号</button></div>
    </form>{!!catalog.flatMap((entry) => entry.accounts).length && <div className="password-manager-app__list">{catalog.flatMap((entry) => entry.accounts).map((item) => <button key={item.id} type="button" className="password-manager-app__list-row" onClick={() => selectAccount(item)}><span><strong>{item.username || '未命名账号'}</strong><small>{catalog.find((entry) => entry.app.id === item.appId)?.app.name ?? '无网站'}</small></span><span>编辑</span></button>)}</div>}{!catalog.flatMap((entry) => entry.accounts).length && <p className="password-manager-app__empty">添加第一个网站后，就可以在这里保存账号。</p>}</section>

    {status && <p className={`password-manager-app__status ${status.error ? 'is-error' : ''}`} role="status" aria-live="polite">{status.text}</p>}<p className="password-manager-app__note">网页浮窗继续使用原有 closed Shadow DOM、页面匹配和填充路径；Desktop 只通过受控 Vault service 读取非敏感目录数据，明文密码不会进入 Desktop Store、BroadcastChannel 或持久化状态。</p>
  </main>

  function selectApp(entry: CatalogEntry): void { const target = entry.app.targets[0]; setApp({ id: entry.app.id, name: entry.app.name, host: target?.host ?? '', path: target?.pathPrefix ?? '' }) }
  function selectAccount(item: VaultAccount): void { setAccount({ id: item.id, appId: item.appId, username: item.username, remark: item.remark ?? '', password: '' }) }
}

function vaultInput(value: typeof EMPTY_VAULT, selectedVaultId: string) {
  const endpoint = normalizeWebDavUrl(value.endpoint)
  const mode = selectedVaultId ? 'reconnect' : value.vaultKey.trim() ? 'existing' : 'create'
  return { mode, vaultId: selectedVaultId || undefined, name: value.name.trim() || new URL(endpoint).hostname, endpoint, username: value.username.trim(), appPassword: value.appPassword, vaultKey: value.vaultKey.trim() || undefined } as const
}

function targetUrl(app: VaultApp): string { const target = app.targets[0]; return target ? `https://${target.host}${target.pathPrefix || '/'}` : '未设置登录地址' }
function syncText(value: VaultSyncStatusResult): string { if (value.state === 'synced') return '已同步'; if (value.state === 'conflict') return `${value.conflicts} 项同步冲突`; if (value.state === 'offline') return `离线 · ${value.dirty} 项待同步`; return `${value.dirty} 项待同步` }
function errorText(reason: unknown): string { return reason instanceof Error ? reason.message : '操作失败，请重试。' }
