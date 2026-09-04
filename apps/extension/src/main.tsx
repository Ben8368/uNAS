import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { bootstrapApiClient } from 'unas-src/api/bootstrap'
import App from 'unas-src/App'
import { AppLoadBoundary } from 'unas-src/components/AppLoadBoundary'
import 'unas-src/styles/globals.css'
import 'unas-src/styles/runtime.css'
import 'unas-src/styles/accessibility.css'

bootstrapApiClient()


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppLoadBoundary resetKey="desktop">
      <App />
    </AppLoadBoundary>
  </StrictMode>,
)
