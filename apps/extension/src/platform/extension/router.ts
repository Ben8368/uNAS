import { webDavRoute } from './handlers/webdav'
import { validateLaunchMessage } from '../workspace/workspaceRouter'
import { extensionApi } from './extensionPlatform'
import { adBlockRoute } from './handlers/adblock'
import { downloadRoute } from './handlers/downloads'
import { linkRoute } from './handlers/links'
import { openPasswordManagerRoute, passwordManagerRoute } from './handlers/password-manager'
import type { MessageRoute, RuntimeResponse } from './routes'

/** Order is part of the contract: earlier routes win, and AdBlock must be tried before the broader Password Manager sender policy. */
const ROUTES: readonly MessageRoute[] = [openPasswordManagerRoute, webDavRoute, adBlockRoute, passwordManagerRoute, linkRoute, downloadRoute]

/** Reject old page bundles instead of allowing them to create a second desktop. */
export function installWorkspaceRouter() {
  const runtime = extensionApi()?.runtime
  if (!runtime?.id) return
  runtime.onMessage.addListener(async (message, sender) => {
    for (const route of ROUTES) {
      if (!route.matches(message)) continue
      if (route.authorize(sender, runtime.id, message)) return await route.handle(message, sender, runtime)
      if (route.rejection) return { ok: false, error: route.rejection } satisfies RuntimeResponse
    }
    return { ok: false, error: validateLaunchMessage(message, sender, runtime.id)
      ? 'App 已改为当前标签页打开，请刷新旧的 uNAS 页面后重试。'
      : '消息来源、版本或动作无效。' } satisfies RuntimeResponse
  })
}
