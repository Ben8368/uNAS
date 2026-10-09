import { handlePasswordManagerMessage, isPasswordManagerMessage } from 'unas-src/features/password-manager/background/service-worker'
import { extensionApi } from '../extensionPlatform'
import { defineRoute } from '../routes'
import { isExtensionPage, isLegacySender } from '../sender-policy'

type OpenPasswordManager = { kind: 'password-manager.open' }

/** Desktop entry: opens the compatibility manage page. Only top-level uNAS pages may ask for it. */
export const openPasswordManagerRoute = defineRoute({
  matches: (message): message is OpenPasswordManager => Boolean(message && typeof message === 'object' && !Array.isArray(message)
    && (message as { kind?: unknown }).kind === 'password-manager.open'),
  authorize: isExtensionPage,
  rejection: '密码管家入口来源无效。',
  async handle(_message, _sender, runtime) {
    const tabs = extensionApi()?.tabs
    if (!tabs || !runtime.getURL) return { ok: false, error: 'uNAS 无法打开密码管家管理页。' }
    await tabs.create({ url: runtime.getURL('manage.html'), active: true })
    return { ok: true }
  },
})

export const passwordManagerRoute = defineRoute({
  matches: isPasswordManagerMessage,
  authorize: isLegacySender,
  rejection: '密码管家消息来源无效。',
  handle: (message, sender) => handlePasswordManagerMessage(message, sender as chrome.runtime.MessageSender),
})
