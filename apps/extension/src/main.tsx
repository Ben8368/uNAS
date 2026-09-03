import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { bootstrapApiClient } from 'unas-src/api/bootstrap'
import App from 'unas-src/App'
import { AppLoadBoundary } from 'unas-src/components/AppLoadBoundary'
import 'unas-src/styles/globals.css'

bootstrapApiClient()

document.documentElement.style.setProperty('--mt-wp', 'url(/static/bg/live/wallpaper-3-dark.webp)')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppLoadBoundary resetKey="desktop">
      <App />
    </AppLoadBoundary>
  </StrictMode>,
)
