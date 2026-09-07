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
})
