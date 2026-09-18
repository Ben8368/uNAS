import { defineContentScript } from 'wxt/utils/define-content-script'

import 'unas-src/unipass/content/blocking/cosmetic-content'

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  allFrames: true,
  runAt: 'document_start',
  world: 'ISOLATED',
  main() {
    // The imported module owns the bounded cosmetic filtering lifecycle.
  },
})
