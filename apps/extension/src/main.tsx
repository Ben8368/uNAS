import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'

import { bootstrapApiClient } from 'unas-src/api/bootstrap'
import App from 'unas-src/App'
import { AppLoadBoundary } from 'unas-src/components/AppLoadBoundary'
import 'unas-src/styles/globals.css'
import 'unas-src/styles/runtime.css'
import 'unas-src/styles/accessibility.css'

bootstrapApiClient()

const MaterialLab = import.meta.env.DEV
  ? lazy(async () => ({ default: (await import('unas-src/MaterialLab')).MaterialLab }))
  : null
const showMaterialLab = MaterialLab !== null && new URLSearchParams(location.search).has('material-lab')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppLoadBoundary resetKey="desktop">
      {showMaterialLab && MaterialLab ? <Suspense fallback={null}><MaterialLab /></Suspense> : <App />}
    </AppLoadBoundary>
  </StrictMode>,
)
