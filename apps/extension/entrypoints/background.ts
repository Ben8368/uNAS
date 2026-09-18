import { defineBackground } from 'wxt/utils/define-background'
import { installWorkspaceRouter } from 'unas-src/runtime/extensionAdapter'

export default defineBackground(() => {
  installWorkspaceRouter()
})
