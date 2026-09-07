import { reloadAfterExtensionAssetLoadError } from 'unas-src/extensionAssetRecovery'

const root = document.getElementById('root')

function showStartupError(error: unknown) {
  if (!root) return

  const message = error instanceof Error ? error.message : String(error)
  root.innerHTML = `
    <main style="display:grid;min-height:100vh;place-items:center;padding:24px;background:#0a0e1a;color:#e2e8f0;font:16px system-ui,sans-serif">
      <section style="max-width:640px;padding:28px;border:1px solid #7f1d1d;border-radius:16px;background:#1f1115">
        <h1 style="margin:0 0 12px">uNAS Demo 启动失败</h1>
        <p style="line-height:1.6">请重新加载页面；若问题持续，请重新构建并重新加载扩展。</p>
        <pre style="margin:16px 0 0;white-space:pre-wrap;color:#fecaca"></pre>
      </section>
    </main>`
  root.querySelector('pre')!.textContent = message
}

function handleStartupFailure(error: unknown) {
  if (!reloadAfterExtensionAssetLoadError(error)) showStartupError(error)
}

// Only module/bootstrap failures may replace the root; React owns it after mount.
import('unas-src/main').catch(handleStartupFailure)
