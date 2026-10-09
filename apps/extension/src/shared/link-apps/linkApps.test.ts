import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyLinkMutation, parseLinks, persistLink, readLinks, validateLink, validateLinkUrl, type LinkApp } from './linkApps'
const saved: LinkApp = { schemaVersion: 1, id: 'a', name: 'Example', url: 'https://example.com/', icon: 'globe' }
beforeEach(() => {
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) })
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
  it('round-trips accepted records and preserves storage when a write exceeds the read budget', async () => {
    await persistLink(saved)
    await expect(readLinks()).resolves.toEqual([saved])
    const links = Array.from({ length: 50 }, (_, i) => ({ ...saved, id: `link-${i}`, name: `Link ${i}`, url: `https://example.com/${'a'.repeat(1980)}` }))
    expect(() => parseLinks(links)).toThrow('大小限制')
    await expect(readLinks()).resolves.toEqual([saved])
  })
  it('rejects duplicate identities and invalid schemas before overwriting storage', async () => {
    await persistLink(saved)
    await expect(persistLink({ ...saved, id: 'b', name: 'Example' })).rejects.toThrow('重复项目')
    await expect(persistLink({ ...saved, id: 'b', schemaVersion: 2 } as unknown as LinkApp)).rejects.toThrow('配置无效')
    await expect(readLinks()).resolves.toEqual([saved])
  })
  it('rejects edits to deleted or changed records without writing', async () => {
    await expect(persistLink({ ...saved, name: 'Draft' }, saved)).rejects.toThrow('另一页面删除')
    await expect(readLinks()).resolves.toEqual([])
    const changed = { ...saved, name: 'Remote edit' }
    await persistLink(changed)
    await expect(persistLink({ ...saved, name: 'Draft' }, saved)).rejects.toThrow('另一页面修改')
    await expect(readLinks()).resolves.toEqual([changed])
  })
  it('merges edits with the latest unrelated records', async () => {
    const other = { ...saved, id: 'b', name: 'Other' }
    await persistLink(saved)
    await persistLink(other)
    const edited = { ...saved, name: 'Edited' }
    await expect(persistLink(edited, saved)).resolves.toEqual([edited, other])
    await expect(readLinks()).resolves.toEqual([edited, other])
  })
  it('rejects an edit that attempts to change a stable Link App id', async () => {
    await persistLink(saved)
    await expect(persistLink({ ...saved, id: 'b' }, saved)).rejects.toThrow('不能变更标识')
    await expect(readLinks()).resolves.toEqual([saved])
  })
  it('migrates legacy Link Apps into extension-local storage once', async () => {
    const extensionStorage = new Map<string, unknown>()
    const changes = { addListener: vi.fn(), removeListener: vi.fn() }
    vi.stubGlobal('browser', { storage: {
      local: {
        get: async (key: string) => ({ [key]: extensionStorage.get(key) }),
        set: async (values: Record<string, unknown>) => { Object.entries(values).forEach(([key, value]) => extensionStorage.set(key, value)) },
      },
      onChanged: changes,
    } })
    localStorage.setItem('unas-link-apps-v1', JSON.stringify([saved]))

    await expect(readLinks()).resolves.toEqual([saved])
    expect(extensionStorage.get('unas-link-apps-v1')).toEqual([saved])
    expect(localStorage.getItem('unas-link-apps-v1')).toBeNull()
  })
  it('serializes local fallback updates and detects a stale deletion', async () => {
    const other = { ...saved, id: 'b', name: 'Other' }
    await Promise.all([persistLink(saved), persistLink(other)])
    const changed = { ...saved, name: 'Changed' }
    await persistLink(changed, saved)
    expect(() => applyLinkMutation([changed, other], { schemaVersion: 1, action: 'link-apps.mutate', kind: 'remove', original: saved })).toThrow('另一页面修改')
    await expect(readLinks()).resolves.toEqual([changed, other])
  })
})
