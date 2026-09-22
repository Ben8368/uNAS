import { defineBackground } from 'wxt/utils/define-background'
import { installWorkspaceRouter } from 'unas-src/runtime/extensionAdapter'
import { installPasswordManagerBackground } from 'unas-src/modules/password-manager/background/service-worker'
import { installAdBlockBackground } from 'unas-src/modules/adblock/background/service-worker'

export default defineBackground(() => {
  installPasswordManagerBackground()
  installAdBlockBackground()
  installWorkspaceRouter()
})
