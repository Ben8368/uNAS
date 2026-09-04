import { describe, expect, it, vi } from 'vitest'
import { createWorkspaceRouter, validateLaunchMessage } from './workspaceRouter'
import { claimWorkspace } from './workspaceSession'
import { installWorkspaceRouter } from './extensionAdapter'
const sender = { id: 'unas', url: 'chrome-extension://unas/newtab.html', frameId: 0 }
const launch = { schemaVersion: 1, action: 'workspace.launch', appId: 'image' }
describe('Workspace routing boundary', () => {
  it('accepts only internal top-level pages and exact versioned app intents', () => {
    expect(validateLaunchMessage(launch, sender, 'unas')).toBe(true)
    for (const invalid of [{ ...launch, schemaVersion: 2 }, { ...launch, appId: '../../secrets' }, { ...launch, action: 'files.read' }, { ...launch, url: 'https://evil.test' }, null]) expect(validateLaunchMessage(invalid, sender, 'unas')).toBe(false)
    for (const invalid of [{ ...sender, id: 'other' }, { ...sender, frameId: 1 }, { ...sender, url: 'https://example.com' }, { ...sender, url: 'chrome-extension://unas/other.html' }]) expect(validateLaunchMessage(launch, invalid, 'unas')).toBe(false)
  })
  it('serializes simultaneous launches and reuses the discovered Workspace', async () => {
    let exists = false
    const create = vi.fn(async () => { exists = true })
    const focus = vi.fn(async () => {})
    const route = createWorkspaceRouter({ discover: async () => exists ? [{ tabId: 4, windowId: 2 }] : [], create, focus })
    await Promise.all([route('image'), route('pdf')])
    expect(create).toHaveBeenCalledTimes(1)
    expect(focus).toHaveBeenCalledWith(4, 2, 'pdf')
  })
  it('does not poison later launches after discovery failure', async () => {
    const discover = vi.fn().mockRejectedValueOnce(new Error('unavailable')).mockResolvedValue([])
    const create = vi.fn(async () => {})
    const route = createWorkspaceRouter({ discover, create, focus: async () => {} })
    await expect(route('image')).rejects.toThrow('unavailable')
    await route('pdf')
    expect(create).toHaveBeenCalledOnce()
  })
  it('does not keep stale tab ids after a Workspace was closed or navigated away', async () => {
    const create = vi.fn(async () => {})
    const focus = vi.fn(async () => {})
    const route = createWorkspaceRouter({ discover: async () => [], create, focus })
    await Promise.all([route('image'), route('archive')])
    expect(create).toHaveBeenCalledTimes(2)
    expect(focus).not.toHaveBeenCalled()
  })
  it('does not guess the owner when duplicate Workspace pages exist', async () => {
    const focus = vi.fn(async () => {})
    const route = createWorkspaceRouter({ discover: async () => [{ tabId: 4, windowId: 2 }, { tabId: 5, windowId: 2 }], create: async () => {}, focus })
    await expect(route('image')).rejects.toThrow('多个 Workspace')
    expect(focus).not.toHaveBeenCalled()
  })
  it('reports missing getContexts instead of opening duplicate Workspace', async () => {
    const respond = vi.fn()
    const create = vi.fn()
    let listener: (...args: any[]) => unknown = () => {}
    vi.stubGlobal('chrome', { runtime: { id: 'unas', getURL: (path: string) => `chrome-extension://unas${path}`, onMessage: { addListener: (fn: typeof listener) => { listener = fn } } }, tabs: { create } })
    installWorkspaceRouter()
    listener(launch, sender, respond)
    await vi.waitFor(() => expect(respond).toHaveBeenCalledWith({ ok: false, error: expect.stringContaining('getContexts') }))
    expect(create).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
  it('does not create another tab while an unconfirmed opening is still loading', async () => {
    vi.useFakeTimers()
    const respond = vi.fn()
    const create = vi.fn(async () => ({ id: 9, windowId: 2 }))
    const update = vi.fn()
    let listener: (...args: any[]) => unknown = () => {}
    vi.stubGlobal('chrome', {
      runtime: { id: 'unas', getURL: (path: string) => `chrome-extension://unas${path}`, getContexts: async () => [], onMessage: { addListener: (fn: typeof listener) => { listener = fn } } },
      tabs: { create, get: async () => ({ status: 'loading' }), update },
    })
    try {
      installWorkspaceRouter()
      listener(launch, sender, respond)
      await vi.advanceTimersByTimeAsync(2100)
      expect(respond).toHaveBeenCalledWith({ ok: false, error: expect.stringContaining('尚未就绪') })
      listener(launch, sender, respond)
      await vi.advanceTimersByTimeAsync(1)
      expect(respond).toHaveBeenLastCalledWith({ ok: false, error: expect.stringContaining('不会重复创建') })
      expect(create).toHaveBeenCalledOnce()
      expect(update).not.toHaveBeenCalled()
    } finally { vi.useRealTimers(); vi.unstubAllGlobals() }
  })
})
describe('Workspace ownership', () => {
  it('never grants ownership when Web Locks are unavailable', () => {
    const report = vi.fn()
    claimWorkspace(undefined, report)()
    expect(report).toHaveBeenCalledWith('unavailable')
  })
  it('refuses an occupied lease', async () => {
    const report = vi.fn()
    const request = vi.fn(async (_name: string, _options: unknown, callback: (lock: null) => Promise<void>) => callback(null))
    claimWorkspace({ request } as unknown as Pick<LockManager, 'request'>, report)
    await Promise.resolve()
    expect(report).toHaveBeenCalledWith('conflict')
  })
})
