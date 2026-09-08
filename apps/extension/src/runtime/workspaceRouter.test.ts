import { describe, expect, it, vi } from 'vitest'
import { validateLaunchMessage } from './workspaceRouter'
import { installWorkspaceRouter } from './extensionAdapter'
const sender = { id: 'unas', url: 'chrome-extension://unas/newtab.html', frameId: 0 }
const launch = { schemaVersion: 1, action: 'workspace.launch', appId: 'fetcher' }
describe('legacy Workspace routing boundary', () => {
  it('recognizes only internal top-level pages and exact versioned app intents', () => {
    expect(validateLaunchMessage(launch, sender, 'unas')).toBe(true)
    for (const invalid of [{ ...launch, schemaVersion: 2 }, { ...launch, appId: '../../secrets' }, { ...launch, action: 'files.read' }, { ...launch, url: 'https://evil.test' }, null]) expect(validateLaunchMessage(invalid, sender, 'unas')).toBe(false)
    for (const invalid of [{ ...sender, id: 'other' }, { ...sender, frameId: 1 }, { ...sender, url: 'https://example.com' }, { ...sender, url: 'chrome-extension://unas/other.html' }]) expect(validateLaunchMessage(launch, invalid, 'unas')).toBe(false)
  })
  it('rejects even valid old launch messages without creating or focusing tabs', async () => {
    const create = vi.fn(); const update = vi.fn()
    let listener: (...args: any[]) => unknown = () => {}
    vi.stubGlobal('browser', { runtime: { id: 'unas', onMessage: { addListener: (fn: typeof listener) => { listener = fn } } }, tabs: { create, update } })
    try {
      installWorkspaceRouter()
      await expect(listener(launch, sender)).resolves.toEqual({ ok: false, error: expect.stringContaining('刷新旧的') })
      await expect(listener(launch, { ...sender, id: 'other' })).resolves.toEqual({ ok: false, error: expect.stringContaining('无效') })
      expect(create).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled()
    } finally { vi.unstubAllGlobals() }
  })
  it('serializes only exact Link App mutations from extension top-level pages', async () => {
    let listener: (...args: any[]) => unknown = () => {}
    const storage = new Map<string, unknown>()
    vi.stubGlobal('browser', {
      runtime: { id: 'unas', onMessage: { addListener: (fn: typeof listener) => { listener = fn } } },
      storage: {
        local: {
          get: async (key: string) => ({ [key]: storage.get(key) }),
          set: async (values: Record<string, unknown>) => { Object.entries(values).forEach(([key, value]) => storage.set(key, value)) },
        },
        onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
      },
    })
    const link = { schemaVersion: 1, id: 'link-a', name: 'Example', url: 'https://example.com/', icon: 'globe' }
    try {
      installWorkspaceRouter()
      await expect(listener({ schemaVersion: 1, action: 'link-apps.mutate', kind: 'upsert', link }, sender)).resolves.toEqual({ ok: true, links: [link] })
      await expect(listener({ schemaVersion: 1, action: 'link-apps.mutate', kind: 'remove', original: link }, { ...sender, id: 'other' })).resolves.toEqual({ ok: false, error: expect.stringContaining('无效') })
      await expect(listener({ schemaVersion: 1, action: 'link-apps.mutate', kind: 'migrate', links: [] }, sender)).resolves.toEqual({ ok: true, links: [link] })
      expect(storage.get('unas-link-apps-v1')).toEqual([link])
    } finally { vi.unstubAllGlobals() }
  })
})
