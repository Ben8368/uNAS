import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { WebComposerPreviewRuntime } from 'unas-src/apps/web-composer/WebComposerPreviewRuntime'
import 'unas-src/apps/web-composer/preview-editor.css'
import 'unas-src/apps/web-composer/presets/presets.css'
import 'unas-src/apps/web-composer/presets/trace-grid.css'
import 'unas-src/apps/web-composer/presets/vex-vision.css'
import 'unas-src/apps/web-composer/presets/foundation.css'
import 'unas-src/apps/web-composer/presets/wandor.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WebComposerPreviewRuntime />
  </StrictMode>,
)
