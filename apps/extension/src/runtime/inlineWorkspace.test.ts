import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInlineWorkspace } from './inlineWorkspace'
import { getApiClient } from 'unas-src/api/client'
import { demoApi } from 'unas-src/api/demo'
import type { SessionMessage } from './workspaceProtocol'

class Channel {
  static instances: Channel[] = []
  onmessage: ((event: MessageEvent) => void) | null = null
  postMessage = vi.fn()
  close = vi.fn()
  constructor() { Channel.instances.push(this) }
  receive(message: unknown) { this.onmessage?.({ data: message } as MessageEvent) }
}
const sessions: ReturnType<typeof createInlineWorkspace>[] = []
beforeEach(() => {
  vi.useFakeTimers(); Channel.instances = []
  vi.stubGlobal('BroadcastChannel', Channel)
  vi.stubGlobal('window', new EventTarget())
  vi.stubGlobal('localStorage', { setItem: vi.fn() })
  vi.stubGlobal('navigator', { locks: { request: async (_name: string, _options: unknown, callback: (lock: null) => void) => callback(null) } })
  demoApi.resetDemoScenario('initial-state')
})
afterEach(() => { sessions.splice(0).forEach(session => session.close()); vi.useRealTimers(); vi.unstubAllGlobals() })
async function connectedClient() {
  const session = createInlineWorkspace(); sessions.push(session)
  const connected = session.connect()
  await vi.advanceTimersByTimeAsync(0)
  const channel = Channel.instances[0]
  channel.receive({ version: 2, type: 'snapshot', sender: 'owner', owner: 'owner', snapshot: demoApi.getDemoSnapshot() })
  await connected
  return { session, channel, api: getApiClient() }
}
describe('inline Workspace session lifecycle', () => {
  it('serializes and deduplicates owner commands and rejects other owner sessions', async () => {
    vi.stubGlobal('navigator', { locks: { request: async (_name: string, _options: unknown, callback: (lock: object) => void) => callback({}) } })
    const session = createInlineWorkspace(); sessions.push(session)
    const connected = session.connect(); await vi.advanceTimersByTimeAsync(0); await connected
    const channel = Channel.instances[0]
    const owner = (channel.postMessage.mock.calls[0][0] as SessionMessage).owner
    const cancel = vi.spyOn(demoApi, 'cancelTask')
    const call = { version: 2, type: 'call', sender: 'client', owner, target: owner, id: 'client:1', method: 'cancelTask', args: ['demo-download-001'] }
    channel.receive({ ...call, owner: 'old-owner' })
    channel.receive(call); channel.receive(call)
    await vi.advanceTimersByTimeAsync(0)
    expect(cancel).toHaveBeenCalledOnce()
    expect(channel.postMessage.mock.calls.some(([message]) => message.type === 'result' && message.id === 'client:1')).toBe(true)
    session.close()
    expect(channel.close).toHaveBeenCalledOnce()
    expect(session.getState()).toBe('lost')
    await expect(session.connect()).rejects.toThrow('不会自动恢复')
  })
  it('fails closed when ownership or channel capability is missing', async () => {
    vi.stubGlobal('navigator', {})
    const session = createInlineWorkspace(); sessions.push(session)
    await expect(session.connect()).rejects.toThrow('缺少')
    expect(session.getState()).toBe('unavailable')
    expect(Channel.instances).toHaveLength(0)
  })
  it('times out discovery and closes the channel instead of becoming a second owner', async () => {
    const session = createInlineWorkspace(); sessions.push(session)
    const rejected = expect(session.connect()).rejects.toThrow('超时')
    await vi.advanceTimersByTimeAsync(5001)
    await rejected
    expect(session.getState()).toBe('unavailable')
    expect(Channel.instances[0].close).toHaveBeenCalledOnce()
  })
  it('matches replies to the current owner and request, and never replays timeout writes', async () => {
    const { session, channel, api } = await connectedClient()
    const promise = api.cancelTask('task-a')
    const call = channel.postMessage.mock.calls.at(-1)![0] as SessionMessage
    channel.receive({ version: 2, type: 'result', sender: 'wrong', owner: 'wrong', id: call.id, value: { ok: true } })
    const rejected = expect(promise).rejects.toThrow('超时')
    await vi.advanceTimersByTimeAsync(5001)
    await rejected
    expect(channel.postMessage.mock.calls.filter(([message]) => message.type === 'call')).toHaveLength(1)
    expect(session.getState()).toBe('client')
  })
  it('aborts a pending client read and ignores a late reply', async () => {
    const { channel, api } = await connectedClient()
    const controller = new AbortController()
    const rejected = expect(api.getActiveTasks(controller.signal)).rejects.toThrow('取消')
    const call = channel.postMessage.mock.calls.at(-1)![0] as SessionMessage
    controller.abort(); await rejected
    channel.receive({ version: 2, type: 'result', sender: 'owner', owner: 'owner', id: call.id, value: { ok: true, tasks: [] } })
  })
  it('marks a silent owner lost without electing itself or replaying work', async () => {
    const { session, api } = await connectedClient()
    await vi.advanceTimersByTimeAsync(16001)
    expect(session.getState()).toBe('lost')
    expect(() => api.cancelTask('task-a')).toThrow('中断')
    await expect(session.connect()).rejects.toThrow('不会自动恢复')
  })
  it('accepts a reset snapshot and rejects remote scenario control', async () => {
    const { channel, api } = await connectedClient()
    demoApi.advanceDemoScenario()
    channel.receive({ version: 2, type: 'snapshot', sender: 'owner', owner: 'owner', snapshot: demoApi.getDemoSnapshot() })
    expect(api.getDemoSnapshot().step).toBe(1)
    demoApi.resetDemoScenario('empty-state')
    channel.receive({ version: 2, type: 'snapshot', sender: 'owner', owner: 'owner', snapshot: demoApi.getDemoSnapshot() })
    expect(api.getDemoSnapshot().tasks).toHaveLength(0)
    expect(() => api.resetDemoScenario('initial-state')).toThrow('仅在')
  })
})
