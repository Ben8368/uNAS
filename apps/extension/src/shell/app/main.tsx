import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'

import { bootstrapApiClient } from 'unas-src/platform/workspace/api/bootstrap'
import App from 'unas-src/shell/app/App'
import { AppLoadBoundary } from 'unas-src/shell/windows/AppLoadBoundary'
import 'unas-src/shared/styles/globals.css'
import 'unas-src/shared/styles/runtime.css'
import 'unas-src/shared/styles/accessibility.css'

bootstrapApiClient()

const MaterialLab = import.meta.env.DEV
  ? lazy(async () => ({ default: (await import('unas-src/shell/desktop/MaterialLab')).MaterialLab }))
  : null
const showMaterialLab = MaterialLab !== null && new URLSearchParams(location.search).has('material-lab')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppLoadBoundary resetKey="desktop">
      {showMaterialLab && MaterialLab ? <Suspense fallback={null}><MaterialLab /></Suspense> : <App />}
    </AppLoadBoundary>
  </StrictMode>,
)
