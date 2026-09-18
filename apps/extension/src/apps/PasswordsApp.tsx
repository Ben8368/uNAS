import { sendExtensionMessage } from 'unas-src/runtime/extensionPlatform'

export function PasswordsApp() {
  const openManager = () => {
    void sendExtensionMessage({ schemaVersion: 1, kind: 'vault.open-manager' })
  }
  return (
    <div className="settings-app settings-app--single">
      <main className="settings-panel">
        <div className="settings-toolbar"><div><h2>密码管理</h2><p>WebDAV 加密密码库与当前网页安全填充</p></div></div>
        <div className="settings-content">
          <section className="settings-card">
            <h3>UniPass 密码库</h3>
            <p>工具栏图标仍会在当前网页打开原版页面浮层；密码库管理、同步和恢复使用同一套 Vault Service。</p>
            <div className="settings-actions"><button type="button" className="settings-save" onClick={openManager}>打开密码库管理器</button></div>
          </section>
        </div>
      </main>
    </div>
  )
}
