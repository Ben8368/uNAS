import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type State = 'idle' | 'owner' | 'client'
let state: State = 'owner'
const workspaceListeners = new Set<() => void>()
const listAuthorizedDirectory = vi.fn(async () => ({ ok: true, executionSource: 'real', path: '/', displayPath: 'Root', truncated: false, directories: [], files: [] }))
const getFileWorkspaceSnapshot = vi.fn(() => ({ status: 'ready' as const }))

vi.mock('unas-src/platform/workspace/inlineWorkspace', () => ({
  inlineWorkspace: {
    getState: () => state,
    subscribe: (listener: () => void) => { workspaceListeners.add(listener); return () => workspaceListeners.delete(listener) },
  },
}))
vi.mock('../real/fileWorkspace', () => ({
  getFileWorkspaceSnapshot,
  listAuthorizedDirectory,
  subscribeFileWorkspace: vi.fn(() => () => undefined),
}))

class FakeChannel {
  static instances: FakeChannel[] = []
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null
  sent: unknown[] = []
  constructor(public name: string) { FakeChannel.instances.push(this) }
  postMessage(message: unknown) { this.sent.push(message) }
  deliver(data: unknown) { this.onmessage?.({ data } as MessageEvent<unknown>) }
}

async function load() {
  vi.resetModules()
  FakeChannel.instances = []
  return await import('./projection-runtime')
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('projection runtime', () => {
  beforeEach(() => {
    state = 'owner'
    workspaceListeners.clear()
    listAuthorizedDirectory.mockClear()
    vi.stubGlobal('BroadcastChannel', FakeChannel)
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('creates the BroadcastChannel only once', async () => {
    const runtime = await load()
    runtime.connectProjection()
    runtime.connectProjection()
    runtime.subscribeProjection(() => undefined)
    expect(FakeChannel.instances).toHaveLength(1)
  })

  it('reports unavailable without BroadcastChannel', async () => {
    vi.stubGlobal('BroadcastChannel', undefined)
    const runtime = await load()
    expect(runtime.connectProjection()).toBe(false)
  })

  it('owner publishes its snapshot on connect and answers a list request addressed to it', async () => {
    const runtime = await load()
    runtime.connectProjection()
    const channel = FakeChannel.instances[0]
    expect(channel.sent[0]).toMatchObject({ type: 'snapshot', snapshot: { status: 'ready' } })
    const self = (channel.sent[0] as { sender: string }).sender
    channel.deliver({ version: 1, type: 'list-request', sender: 'client-9', id: 'r1', path: '/x' })
    await flush()
    expect(listAuthorizedDirectory).toHaveBeenCalledWith('/x')
    expect(channel.sent.at(-1)).toMatchObject({ type: 'list-result', sender: self, target: 'client-9', id: 'r1' })
  })

  it('ignores malformed, self-sent and differently-targeted messages', async () => {
    const runtime = await load()
    runtime.connectProjection()
    const channel = FakeChannel.instances[0]
    const self = (channel.sent[0] as { sender: string }).sender
    const before = channel.sent.length
    channel.deliver({ version: 1, type: 'list-request', sender: 'client-9', id: 'r1', extra: true })
    channel.deliver({ version: 1, type: 'list-request', sender: self, id: 'r2' })
    channel.deliver({ version: 1, type: 'snapshot-request', sender: 'client-9', id: 'r3', target: 'someone-else' })
    channel.deliver({ version: 1, type: 'list-result', sender: 'client-9', target: 'someone-else', id: 'r4', error: 'x' })
    await flush()
    expect(listAuthorizedDirectory).not.toHaveBeenCalled()
    expect(channel.sent).toHaveLength(before)
  })

  it('a client never answers requests or publishes snapshots', async () => {
    state = 'client'
    const runtime = await load()
    runtime.connectProjection()
    const channel = FakeChannel.instances[0]
    channel.deliver({ version: 1, type: 'list-request', sender: 'client-9', id: 'r1' })
    channel.deliver({ version: 1, type: 'snapshot-request', sender: 'client-9', id: 'r2' })
    workspaceListeners.forEach((listener) => listener())
    await flush()
    expect(listAuthorizedDirectory).not.toHaveBeenCalled()
    expect(channel.sent.filter((message) => (message as { type: string }).type !== 'snapshot-request')).toHaveLength(0)
  })

  it('a client caches pushed snapshots and notifies subscribers', async () => {
    state = 'client'
    const runtime = await load()
    const listener = vi.fn()
    runtime.subscribeProjection(listener)
    FakeChannel.instances[0].deliver({ version: 1, type: 'snapshot', sender: 'owner-1', snapshot: { status: 'ready', displayName: 'Docs' } })
    await flush()
    expect(runtime.projectionClient.getSnapshot()).toMatchObject({ displayName: 'Docs' })
    expect(listener).toHaveBeenCalled()
  })

  it('an idle context ignores everything', async () => {
    state = 'idle'
    const runtime = await load()
    runtime.connectProjection()
    const channel = FakeChannel.instances[0]
    channel.deliver({ version: 1, type: 'snapshot', sender: 'owner-1', snapshot: { status: 'ready' } })
    await flush()
    expect(runtime.projectionClient.getSnapshot()).toMatchObject({ status: 'idle' })
  })
})
