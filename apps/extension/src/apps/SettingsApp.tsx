import { lazy, Suspense } from 'react'
import { Server } from 'lucide-react'
import { ResizableAppSidebar } from 'unas-src/components/ResizableAppSidebar'

const WebDavSettings = lazy(() => import('unas-src/apps/settings/WebDavSettings').then((module) => ({ default: module.WebDavSettings })))

export function SettingsApp() {
  return (
    <div className="settings-app">
      <ResizableAppSidebar className="settings-sidebar app-sidebar" storageKey="settings">
        <nav className="settings-nav app-nav" aria-label="设置分类">
          <button type="button" className="settings-nav-item app-nav-item app-nav-item--active" aria-current="page">
            <Server aria-hidden="true" /><span>WebDAV</span>
          </button>
        </nav>
      </ResizableAppSidebar>
      <main className="settings-panel">
        <header className="settings-toolbar"><div><h2>WebDAV</h2><p>管理密码库的 WebDAV 连接与认证信息。</p></div></header>
        <div className="settings-stage">
          <Suspense fallback={<p role="status">正在加载 WebDAV 设置…</p>}><WebDavSettings /></Suspense>
        </div>
      </main>
    </div>
  )
}
