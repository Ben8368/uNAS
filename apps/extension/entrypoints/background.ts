import { defineBackground } from 'wxt/utils/define-background'
import { installWorkspaceRouter } from 'unas-src/platform/extension/router'
import { installPasswordManagerBackground } from 'unas-src/features/password-manager/background/service-worker'
import { installAdBlockBackground } from 'unas-src/features/adblock/background/service-worker'

export default defineBackground(() => {
  installPasswordManagerBackground()
  installAdBlockBackground()
  installWorkspaceRouter()
})
