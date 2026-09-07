import { defineBackground } from 'wxt/utils/define-background'
import { installToolbarAction, installWorkspaceRouter } from 'unas-src/runtime/extensionAdapter'

export default defineBackground(() => {
  installWorkspaceRouter()
  installToolbarAction()
})
