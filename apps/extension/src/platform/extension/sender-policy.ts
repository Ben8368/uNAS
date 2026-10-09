import type { ExtensionMessageSender } from './extensionPlatform'
import { isExtensionPageSender, isWebPageSender } from './sender-guard'

/** Top-level uNAS pages that may drive Link Apps, downloads and the Password Manager entry. */
export function isExtensionPage(sender: ExtensionMessageSender, extensionId: string) {
  if (sender.id !== extensionId || (sender.frameId !== undefined && sender.frameId !== 0)) return false
  try {
    const url = new URL(sender.url || '')
    return url.protocol === 'chrome-extension:' && url.host === extensionId && ['/newtab.html', '/workspace.html'].includes(url.pathname)
  } catch { return false }
}

export function isUniPassSender(sender: ExtensionMessageSender, extensionId: string, message?: unknown): boolean {
  // The password overlay is injected into an HTTPS page and must be able to
  // complete its own fill handoff. AdBlock is routed separately below.
  if (isWebPageSender(sender, extensionId)) return true
  return isExtensionPageSender(sender, extensionId, ['/newtab.html', '/workspace.html', '/popup.html', '/manage.html'])
}

/** AdBlock has a narrower route: web pages may only request cosmetic rules. */
export function isAdBlockSender(sender: ExtensionMessageSender, extensionId: string, message?: unknown): boolean {
  const isCosmeticRulesRequest = Boolean(message && typeof message === 'object' && !Array.isArray(message)
    && Object.keys(message).sort().join(',') === 'type'
    && (message as { type?: unknown }).type === 'getCosmeticRules')
  if (isWebPageSender(sender, extensionId, isCosmeticRulesRequest)) return true
  return isExtensionPageSender(sender, extensionId, ['/newtab.html', '/workspace.html'])
}
