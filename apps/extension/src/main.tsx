import { StrictMode } from 'react'
import { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Navigate, Routes, Route } from 'react-router-dom'

import { bootstrapApiClient } from 'unas-src/api/bootstrap'
import App from 'unas-src/App'
import { AppLoadBoundary } from 'unas-src/components/AppLoadBoundary'
import 'unas-src/styles/globals.css'

const PresetStandalonePage = lazy(() => import('unas-src/pages/PresetStandalonePage')
  .then((module) => ({ default: module.PresetStandalonePage })))

bootstrapApiClient()

document.documentElement.style.setProperty('--mt-wp', 'url(/static/bg/live/wallpaper-3-dark.webp)')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <AppLoadBoundary resetKey={window.location.hash}>
        <Suspense fallback={<div className="mt-app-loading mt-app-loading--fullscreen" role="status">正在加载...</div>}>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/preset" element={<Navigate to="/preset/lumora" replace />} />
            <Route path="/preset/:presetId" element={<PresetStandalonePage />} />
            {/* Extension pages are addressed as /newtab.html and /workspace.html.
                Keep the desktop reachable if a browser restores that pathname
                instead of the hash-based route. */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AppLoadBoundary>
    </HashRouter>
  </StrictMode>,
)
