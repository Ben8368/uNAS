export type LinkApp = { schemaVersion: 1; id: string; name: string; url: string; icon: 'globe' | 'bookmark' }
const KEY = 'unas-link-apps-v1'
const CHANGED_EVENT = 'unas-link-apps-changed'
const MAX_CONFIG_CHARACTERS = 100_000
export function validateLinkUrl(input: string): { url: string } | { error: string } {
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
function parseLinks(raw: string): LinkApp[] {
  if (raw.length > MAX_CONFIG_CHARACTERS) throw new Error('Link App 配置超过大小限制。')
  const value: unknown = JSON.parse(raw)
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
export function readLinks(): LinkApp[] {
  const raw = localStorage.getItem(KEY)
  return raw ? parseLinks(raw) : []
}
export function saveLinks(links: LinkApp[]) {
  if (links.length > 50) throw new Error('最多保存 50 个 Link App。')
  const raw = JSON.stringify(links)
  parseLinks(raw)
  localStorage.setItem(KEY, raw)
  window.dispatchEvent(new Event(CHANGED_EVENT))
}
export function persistLink(link: LinkApp, original?: LinkApp): LinkApp[] {
  const latest = readLinks()
  if (original) {
    const current = latest.find((item) => item.id === original.id)
    if (!current) throw new Error('此 App 已在另一页面删除；草稿已保留，请取消编辑后重新添加。')
    if (current.name !== original.name || current.url !== original.url || current.icon !== original.icon) {
      throw new Error('此 App 已在另一页面修改；草稿已保留，请核对最新记录后重新编辑。')
    }
  }
  const next = original ? latest.map((item) => item.id === original.id ? link : item) : [...latest, link]
  saveLinks(next)
  return next
}
export function subscribeLinks(listener: () => void) {
  window.addEventListener(CHANGED_EVENT, listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener(CHANGED_EVENT, listener)
    window.removeEventListener('storage', listener)
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
