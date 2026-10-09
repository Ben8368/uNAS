import type { DavDirectoryListing, DavFileEntry } from '#contracts'

const DAV = 'DAV:'
const maxListingBytes = 1024 * 1024
const hasControl = (value: string) => [...value].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
export function davName(name: string) {
  if (!name.trim() || name.length > 200 || name === '.' || name === '..' || /[\\/%?#:]/.test(name) || hasControl(name)) throw new Error('文件名无效，不能包含路径分隔符或特殊路径字符。')
  return name
}
export function davPath(path: string) {
  if (path.length > 4096 || path.startsWith('/') || path.includes('//')) throw new Error('WebDAV 路径无效。')
  for (const part of path.replace(/\/$/, '').split('/').filter(Boolean)) davName(decodeURIComponent(part))
  return path
}
const child = (node: Element, name: string) => Array.from(node.children).find(element => element.namespaceURI === DAV && element.localName === name)
const children = (node: Element, name: string) => Array.from(node.children).filter(element => element.namespaceURI === DAV && element.localName === name)
const text = (node: Element, name: string) => child(node, name)?.textContent?.trim() ?? ''

/** Strict namespace-aware Depth:1 projection; response hrefs never become arbitrary fetch URLs. */
export function parseDavListing(xml: string, endpoint: string, path: string): DavDirectoryListing {
  davPath(path)
  if (new TextEncoder().encode(xml).length > maxListingBytes || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('WebDAV 目录响应超过预算或包含不允许的 XML 声明。')
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  const root = document.documentElement
  if (document.getElementsByTagName('parsererror').length || root.namespaceURI !== DAV || root.localName !== 'multistatus') throw new Error('服务器未返回有效的 WebDAV 目录列表。')
  const responses = children(root, 'response')
  if (responses.length > 1001) throw new Error('WebDAV 目录超过枚举预算，请缩小目录范围。')
  const base = new URL(endpoint)
  const requested = new URL(path, base).pathname.replace(/\/$/, '')
  const entries: DavFileEntry[] = []
  const seen = new Set<string>()
  let verifiedDirectory = false
  for (const response of responses) {
    const href = text(response, 'href')
    if (!href || href.includes('\\') || hasControl(href)) throw new Error('WebDAV 返回了无效的文件路径。')
    const url = new URL(href, new URL(path, base))
    if (url.origin !== base.origin || url.search || url.hash || url.username || url.password || !url.pathname.startsWith(base.pathname)) throw new Error('WebDAV 返回了授权目录之外的路径。')
    const properties = children(response, 'propstat').filter(item => /^HTTP\/\S+ 200(?:\s|$)/.test(text(item, 'status'))).map(item => child(item, 'prop')).filter((item): item is Element => Boolean(item))
    const property = (name: string) => properties.map(prop => child(prop, name)).find(Boolean)
    const resourceType = property('resourcetype')
    const directory = Boolean(resourceType && child(resourceType, 'collection'))
    const absolute = url.pathname.replace(/\/$/, '')
    if (absolute === requested) { if (directory) verifiedDirectory = true; continue }
    if (!absolute.startsWith(`${requested}/`) || absolute.slice(requested.length + 1).includes('/')) throw new Error('WebDAV Depth:1 响应包含非直接子项。')
    if (!resourceType) throw new Error('WebDAV 条目缺少有效的资源类型或读取权限。')
    const encoded = absolute.slice(requested.length + 1)
    const name = davName(decodeURIComponent(encoded))
    const canonical = `${path}${encodeURIComponent(name)}${directory ? '/' : ''}`
    if (seen.has(canonical)) throw new Error('WebDAV 返回了重复的文件条目。')
    seen.add(canonical)
    const sizeText = property('getcontentlength')?.textContent?.trim()
    const size = sizeText ? Number(sizeText) : 0
    if (!Number.isSafeInteger(size) || size < 0) throw new Error('WebDAV 文件大小无效。')
    const modified = property('getlastmodified')?.textContent?.trim() ?? ''
    const etag = property('getetag')?.textContent?.trim()
    entries.push({ name, path: canonical, size, modified: Number.isFinite(Date.parse(modified)) ? new Date(modified).toISOString() : '', type: directory ? 'directory' : 'file', executionSource: 'real', extension: name.includes('.') ? name.split('.').at(-1) : undefined, etag })
  }
  if (!verifiedDirectory) throw new Error('无法确认目标 WebDAV 目录可读取。')
  return { path, entries: entries.slice(0, 200), truncated: entries.length > 200 }
}
