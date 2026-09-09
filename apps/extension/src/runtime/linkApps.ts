import {
  getExtensionLocalValue,
  hasExtensionLocalStorage,
  hasExtensionMessageRuntime,
  sendExtensionMessage,
  setExtensionLocalValue,
  subscribeExtensionLocalChanges,
} from './extensionPlatform'

export type LinkApp = { schemaVersion: 1; id: string; name: string; url: string; icon: 'globe' | 'bookmark' }
const KEY = 'unas-link-apps-v1'
const CHANGED_EVENT = 'unas-link-apps-changed'
const MAX_CONFIG_CHARACTERS = 100_000
let localMutationTail = Promise.resolve()

export type LinkMutation =
  | { schemaVersion: 1; action: 'link-apps.mutate'; kind: 'upsert'; link: LinkApp; original?: LinkApp }
  | { schemaVersion: 1; action: 'link-apps.mutate'; kind: 'remove'; original: LinkApp }
  | { schemaVersion: 1; action: 'link-apps.mutate'; kind: 'migrate'; links: LinkApp[] }
export function validateLinkUrl(input: string): { url: string } | { error: string } {
  // Reject whitespace and C0/DEL controls before URL parsing.
  // eslint-disable-next-line no-control-regex
  if (input.length > 2048 || /[\u0000-\u0020\u007f]/.test(input)) return { error: '网址不能包含空格、控制字符或超过 2048 个字符。' }
  try {
    const url = new URL(input)
    if (url.protocol !== 'https:') return { error: 'Link App 只允许完整的 HTTPS 网址，例如 https://example.com。' }
    if (url.username || url.password) return { error: '网址不能包含用户名或密码。' }
    return { url: url.href }
  } catch { return { error: '请输入有效的完整 HTTPS 网址。' } }
}
export function validateLink(input: Pick<LinkApp, 'name' | 'url'>, existing: LinkApp[], editingId?: string): string | null {
  const name = input.name.trim()
  if (!name || name.length > 60) return '名称须为 1–60 个字符。'
  if (existing.some((link) => link.id !== editingId && link.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return '已有同名 Link App，请使用不同名称。'
  const result = validateLinkUrl(input.url)
  return 'error' in result ? result.error : null
}
export function parseLinks(value: unknown): LinkApp[] {
  const raw = JSON.stringify(value)
  if (raw.length > MAX_CONFIG_CHARACTERS) throw new Error('Link App 配置超过大小限制。')
  if (!Array.isArray(value) || value.length > 50) throw new Error('本地 Link App 配置无效，无法加载。')
  const ids = new Set<string>()
  const names = new Set<string>()
  for (const link of value) {
    if (!link || link.schemaVersion !== 1 || typeof link.id !== 'string' || !link.id || link.id.length > 80 || typeof link.name !== 'string' || typeof link.url !== 'string' || !['globe', 'bookmark'].includes(link.icon) || validateLink(link, [])) throw new Error('本地 Link App 配置无效，无法加载。')
    const normalizedName = link.name.trim().toLocaleLowerCase()
    if (ids.has(link.id) || names.has(normalizedName)) throw new Error('本地 Link App 配置包含重复项目，无法加载。')
    ids.add(link.id)
    names.add(normalizedName)
  }
  return value as LinkApp[]
}

function sameLink(left: LinkApp, right: LinkApp) {
  return left.id === right.id && left.name === right.name && left.url === right.url && left.icon === right.icon
}

function parseMutation(value: unknown): LinkMutation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Link App 更新请求无效。')
  const mutation = value as Record<string, unknown>
  const keys = Object.keys(mutation).sort().join(',')
  if (mutation.schemaVersion !== 1 || mutation.action !== 'link-apps.mutate') throw new Error('Link App 更新请求无效。')
  if (mutation.kind === 'upsert' && (keys === 'action,kind,link,schemaVersion' || keys === 'action,kind,link,original,schemaVersion')) {
    const link = parseLinks([mutation.link])[0]
    const original = mutation.original === undefined ? undefined : parseLinks([mutation.original])[0]
    return { schemaVersion: 1, action: 'link-apps.mutate', kind: 'upsert', link, ...(original ? { original } : {}) }
  }
  if (mutation.kind === 'remove' && keys === 'action,kind,original,schemaVersion') {
    return { schemaVersion: 1, action: 'link-apps.mutate', kind: 'remove', original: parseLinks([mutation.original])[0] }
  }
  if (mutation.kind === 'migrate' && keys === 'action,kind,links,schemaVersion') {
    return { schemaVersion: 1, action: 'link-apps.mutate', kind: 'migrate', links: parseLinks(mutation.links) }
  }
  throw new Error('Link App 更新请求无效。')
}

export function isLinkMutation(value: unknown): value is LinkMutation {
  try { parseMutation(value); return true } catch { return false }
}

export function applyLinkMutation(current: LinkApp[], value: unknown): LinkApp[] {
  const mutation = parseMutation(value)
  const latest = parseLinks(current)
  if (mutation.kind === 'migrate') return parseLinks(mutation.links)
  const original = mutation.original
  if (original) {
    if (mutation.kind === 'upsert' && mutation.link.id !== original.id) throw new Error('编辑 Link App 时不能变更标识。')
    const existing = latest.find((link) => link.id === original.id)
    if (!existing) throw new Error('此 App 已在另一页面删除；草稿已保留，请刷新后重试。')
    if (!sameLink(existing, original)) throw new Error('此 App 已在另一页面修改；草稿已保留，请刷新后重试。')
  }
  const next = mutation.kind === 'remove'
    ? latest.filter((link) => link.id !== mutation.original.id)
    : mutation.original
      ? latest.map((link) => link.id === mutation.original!.id ? mutation.link : link)
      : [...latest, mutation.link]
  return parseLinks(next)
}

function readLegacyLinks(): LinkApp[] {
  const raw = localStorage.getItem(KEY)
  return raw ? parseLinks(JSON.parse(raw)) : []
}

/** Use extension-local persistence in packaged pages; localStorage only keeps Vite's standalone mock usable. */
export async function readLinks(): Promise<LinkApp[]> {
  if (!hasExtensionLocalStorage()) return readLegacyLinks()
  const stored = await getExtensionLocalValue(KEY)
  if (stored !== undefined) return parseLinks(stored)

  const legacy = readLegacyLinks()
  if (legacy.length) {
    if (hasExtensionMessageRuntime()) {
      const migrated = await mutateLinks({ schemaVersion: 1, action: 'link-apps.mutate', kind: 'migrate', links: legacy })
      localStorage.removeItem(KEY)
      return migrated
    }
    await setExtensionLocalValue(KEY, legacy)
    localStorage.removeItem(KEY)
  }
  return legacy
}

async function saveLinks(links: LinkApp[]) {
  const checked = parseLinks(links)
  if (hasExtensionLocalStorage()) await setExtensionLocalValue(KEY, checked)
  else localStorage.setItem(KEY, JSON.stringify(checked))
  window.dispatchEvent(new Event(CHANGED_EVENT))
}

async function mutateLegacyLinks(mutation: LinkMutation): Promise<LinkApp[]> {
  const update = async () => {
    const next = applyLinkMutation(await readLinks(), mutation)
    await saveLinks(next)
    return next
  }
  const result = localMutationTail.then(update, update)
  localMutationTail = result.then(() => undefined, () => undefined)
  return await result
}

async function mutateLinks(mutation: LinkMutation): Promise<LinkApp[]> {
  if (!hasExtensionMessageRuntime()) return await mutateLegacyLinks(mutation)
  const result = await sendExtensionMessage(mutation)
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Link App 更新响应无效。')
  const response = result as { ok?: unknown; links?: unknown; error?: unknown }
  if (response.ok !== true) throw new Error(typeof response.error === 'string' ? response.error : 'Link App 更新失败。')
  return parseLinks(response.links)
}

export async function persistLink(link: LinkApp, original?: LinkApp): Promise<LinkApp[]> {
  return await mutateLinks({ schemaVersion: 1, action: 'link-apps.mutate', kind: 'upsert', link, ...(original ? { original } : {}) })
}

export async function removeLink(original: LinkApp): Promise<LinkApp[]> {
  return await mutateLinks({ schemaVersion: 1, action: 'link-apps.mutate', kind: 'remove', original })
}
export function subscribeLinks(listener: () => void) {
  const localStorageListener = () => listener()
  window.addEventListener(CHANGED_EVENT, localStorageListener)
  window.addEventListener('storage', localStorageListener)
  const unsubscribeExtensionStorage = subscribeExtensionLocalChanges(KEY, listener)
  return () => {
    window.removeEventListener(CHANGED_EVENT, localStorageListener)
    window.removeEventListener('storage', localStorageListener)
    unsubscribeExtensionStorage()
  }
}
export function openLink(url: string) {
  const valid = validateLinkUrl(url)
  if ('error' in valid) throw new Error(valid.error)
  const anchor = document.createElement('a')
  anchor.href = valid.url
  anchor.target = '_blank'
  anchor.rel = 'noopener noreferrer'
  anchor.click()
}
