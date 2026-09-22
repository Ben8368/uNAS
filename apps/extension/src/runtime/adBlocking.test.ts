import { afterEach, describe, expect, it, vi } from 'vitest'
import { readAdBlockingStatus, refreshAdBlockingStatus } from './adBlocking'
import { hasExtensionMessageRuntime, sendExtensionMessage } from './extensionPlatform'

vi.mock('./extensionPlatform', () => ({ hasExtensionMessageRuntime: vi.fn(), sendExtensionMessage: vi.fn() }))
afterEach(() => { vi.resetAllMocks(); vi.useRealTimers() })

describe('advertising blocking status boundary', () => {
  it('does not fabricate status in Web preview', async () => {
    vi.mocked(hasExtensionMessageRuntime).mockReturnValue(false)
    expect(await readAdBlockingStatus()).toBeNull()
    expect(sendExtensionMessage).not.toHaveBeenCalled()
  })
  it.each(['baseline-only', 'ready', 'stale', 'error'])('preserves backend state: %s', async (state) => {
    vi.mocked(hasExtensionMessageRuntime).mockReturnValue(true)
    const status = { enabled: true, ready: state === 'ready', state, ruleCount: 0, baselineRuleCount: 26 }
    vi.mocked(sendExtensionMessage).mockResolvedValue({ ok: true, data: status })
    expect(await readAdBlockingStatus()).toEqual(status)
  })
  it('requests a repository retry and returns its refreshed status', async () => {
    vi.mocked(hasExtensionMessageRuntime).mockReturnValue(true)
    const status = { enabled: true, ready: true, state: 'ready' as const, ruleCount: 1, baselineRuleCount: 26 }
    vi.mocked(sendExtensionMessage).mockResolvedValue({ ok: true, data: status })
    await expect(refreshAdBlockingStatus()).resolves.toEqual(status)
    expect(sendExtensionMessage).toHaveBeenCalledWith({ type: 'refreshBlockingSubscriptions' })
  })
  it.each([undefined, { error: 'Rejected' }, { ok: true, data: { enabled: true, state: 'ready', ready: true, ruleCount: -1, baselineRuleCount: 26 } }])('rejects invalid replies', async (reply) => {
    vi.mocked(hasExtensionMessageRuntime).mockReturnValue(true)
    vi.mocked(sendExtensionMessage).mockResolvedValue(reply)
    await expect(readAdBlockingStatus()).rejects.toThrow()
  })
  it('bounds an unresponsive message request', async () => {
    vi.useFakeTimers()
    vi.mocked(hasExtensionMessageRuntime).mockReturnValue(true)
    vi.mocked(sendExtensionMessage).mockReturnValue(new Promise(() => {}))
    const result = expect(readAdBlockingStatus()).rejects.toThrow('超时')
    await vi.advanceTimersByTimeAsync(25_000)
    await result
    expect(vi.getTimerCount()).toBe(0)
  })
})
