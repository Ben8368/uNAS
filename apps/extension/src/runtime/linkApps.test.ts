import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { persistLink, readLinks, saveLinks, validateLink, validateLinkUrl, type LinkApp } from './linkApps'
const saved: LinkApp = { schemaVersion: 1, id: 'a', name: 'Example', url: 'https://example.com/', icon: 'globe' }
beforeEach(() => {
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) })
  vi.stubGlobal('window', { dispatchEvent: vi.fn() })
})
afterEach(() => vi.unstubAllGlobals())
describe('declarative Link App', () => {
  it('rejects privileged, insecure, malformed and credential-bearing URLs', () => {
    for (const url of ['http://example.com', 'javascript:alert(1)', 'data:text/html,test', 'file:///test', 'chrome://settings', 'chrome-extension://unas/workspace.html', 'about:blank', 'https://user:secret@example.com', 'https://exam\nple.com', 'example.com']) expect(validateLinkUrl(url)).toHaveProperty('error')
    expect(validateLinkUrl('https://example.com/path?a=1')).toEqual({ url: 'https://example.com/path?a=1' })
  })
  it('validates names and permits editing the same app', () => {
    const saved: LinkApp = { schemaVersion: 1, id: 'a', name: 'Example', url: 'https://example.com/', icon: 'globe' }
    expect(validateLink({ ...saved, name: 'example' }, [saved])).toContain('同名')
    expect(validateLink(saved, [saved], 'a')).toBeNull()
    expect(validateLink({ ...saved, name: '' }, [])).toContain('名称')
  })
  it('round-trips accepted records and preserves storage when a write exceeds the read budget', () => {
    saveLinks([saved])
    expect(readLinks()).toEqual([saved])
    const links = Array.from({ length: 50 }, (_, i) => ({ ...saved, id: `link-${i}`, name: `Link ${i}`, url: `https://example.com/${'a'.repeat(1980)}` }))
    expect(() => saveLinks(links)).toThrow('大小限制')
    expect(readLinks()).toEqual([saved])
  })
  it('rejects duplicate identities and invalid schemas before overwriting storage', () => {
    saveLinks([saved])
    expect(() => saveLinks([saved, { ...saved, name: 'Other' }])).toThrow('重复项目')
    expect(() => saveLinks([{ ...saved, schemaVersion: 2 } as unknown as LinkApp])).toThrow('配置无效')
    expect(readLinks()).toEqual([saved])
  })
  it('rejects edits to deleted or changed records without writing', () => {
    saveLinks([])
    expect(() => persistLink({ ...saved, name: 'Draft' }, saved)).toThrow('另一页面删除')
    expect(readLinks()).toEqual([])
    const changed = { ...saved, name: 'Remote edit' }
    saveLinks([changed])
    expect(() => persistLink({ ...saved, name: 'Draft' }, saved)).toThrow('另一页面修改')
    expect(readLinks()).toEqual([changed])
  })
  it('merges edits with the latest unrelated records', () => {
    const other = { ...saved, id: 'b', name: 'Other' }
    saveLinks([saved, other])
    const edited = { ...saved, name: 'Edited' }
    expect(persistLink(edited, saved)).toEqual([edited, other])
    expect(readLinks()).toEqual([edited, other])
  })
})
