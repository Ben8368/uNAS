import { handleAdBlockMessage, isAdBlockMessage } from 'unas-src/features/adblock/background/service-worker'
import { defineRoute } from '../routes'
import { isAdBlockSender } from '../sender-policy'

export const adBlockRoute = defineRoute({
  matches: isAdBlockMessage,
  authorize: isAdBlockSender,
  rejection: '广告拦截消息来源无效。',
  handle: (message, sender) => handleAdBlockMessage(message, sender as chrome.runtime.MessageSender),
})
