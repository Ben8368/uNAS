import { defineBackground } from 'wxt/utils/define-background'
import { installWorkspaceRouter } from 'unas-src/runtime/extensionAdapter'
import { installUniPassBackground } from 'unas-src/unipass/background/service-worker'

export default defineBackground(() => {
  installUniPassBackground()
  installWorkspaceRouter()
})
