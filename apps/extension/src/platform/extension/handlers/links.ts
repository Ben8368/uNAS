import { applyLinkMutation, isLinkMutation, parseLinks } from 'unas-src/shared/link-apps/linkApps'
import { getExtensionLocalValue, setExtensionLocalValue } from '../extensionPlatform'
import { defineRoute, type RuntimeResponse } from '../routes'
import { isExtensionPage } from '../sender-policy'

const LINK_STORAGE_KEY = 'unas-link-apps-v1'
let linkMutationTail = Promise.resolve()

async function mutateLinks(message: unknown): Promise<RuntimeResponse> {
  const update = async () => {
    try {
      const stored = await getExtensionLocalValue(LINK_STORAGE_KEY)
      if (isLinkMutation(message) && message.kind === 'migrate' && stored !== undefined) return { ok: true, links: parseLinks(stored) } as const
      const current = parseLinks(stored ?? [])
      const links = applyLinkMutation(current, message)
      await setExtensionLocalValue(LINK_STORAGE_KEY, links)
      return { ok: true, links } as const
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Link App 更新失败。' } as const
    }
  }
  const result = linkMutationTail.then(update, update)
  linkMutationTail = result.then(() => undefined, () => undefined)
  return await result
}

/** No `rejection`: an unauthorized mutation falls through to the generic invalid-source answer. */
export const linkRoute = defineRoute({
  matches: isLinkMutation,
  authorize: isExtensionPage,
  handle: message => mutateLinks(message),
})
