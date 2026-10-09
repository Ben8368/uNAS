import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthorizedDirectoryListing, FileWorkspaceAccessSnapshot } from '#contracts'
import { createProjectionClient } from './projection-client'
import { handleHostMessage, publishSnapshot, type ProjectionHostDeps } from './projection-host'
import { MAX_PENDING_REQUESTS, REQUEST_TIMEOUT_MS, type ProjectionMessage } from './protocol'

const listing: AuthorizedDirectoryListing = { ok: true, executionSource: 'real', path: '/', displayPath: 'Root', truncated: false, directories: [], files: [] }
const snapshot: FileWorkspaceAccessSnapshot = { status: 'ready', displayName: 'Docs' }

function clientHarness(overrides: { isClient?: boolean; connect?: boolean; post?: (message: ProjectionMessage) => void } = {}) {
  const posted: ProjectionMessage[] = []
  const client = createProjectionClient({
    self: () => 'client-1',
    isClient: () => overrides.isClient ?? true,
    connect: () => overrides.connect ?? true,
    post: overrides.post ?? ((message) => { posted.push(message) }),
  })
  return { client, posted }
}

function hostHarness(overrides: Partial<ProjectionHostDeps> = {}) {
  const posted: ProjectionMessage[] = []
  const deps: ProjectionHostDeps = {
    self: () => 'owner-1',
    isOwner: () => true,
    post: (message) => { posted.push(message) },
    getSnapshot: () => snapshot,
    listDirectory: async () => listing,
    ...overrides,
  }
  return { deps, posted }
}

describe('projection client', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('correlates a list result with its request id and clears pending', async () => {
    const { client, posted } = clientHarness()
    const first = client.listDirectory('/a')
    const second = client.listDirectory('/b')
    expect(posted.map((message) => message.type === 'list-request' && message.path)).toEqual(['/a', '/b'])
    const [a, b] = posted as Extract<ProjectionMessage, { type: 'list-request' }>[]
    const other = { ...listing, path: '/b' }
    client.receive({ version: 1, type: 'list-result', sender: 'owner-1', target: 'client-1', id: b.id, listing: other })
    client.receive({ version: 1, type: 'list-result', sender: 'owner-1', target: 'client-1', id: a.id, listing })
    await expect(second).resolves.toBe(other)
    await expect(first).resolves.toBe(listing)
    expect(client.pendingCount()).toBe(0)
  })

  it('ignores results for unknown ids', () => {
    const { client } = clientHarness()
    expect(client.receive({ version: 1, type: 'list-result', sender: 'owner-1', target: 'client-1', id: 'nope', listing })).toBe(false)
  })

  it('rejects with the host error and clears pending', async () => {
    const { client, posted } = clientHarness()
    const result = client.listDirectory()
    client.receive({ version: 1, type: 'list-result', sender: 'owner-1', target: 'client-1', id: (posted[0] as { id: string }).id, error: 'boom' })
    await expect(result).rejects.toThrow('boom')
    expect(client.pendingCount()).toBe(0)
  })

  it('rejects an empty result as an invalid projection', async () => {
    const { client, posted } = clientHarness()
    const result = client.listDirectory()
    client.receive({ version: 1, type: 'list-result', sender: 'owner-1', target: 'client-1', id: (posted[0] as { id: string }).id })
    await expect(result).rejects.toThrow('无效的列表投影')
  })

  it('removes the pending entry after timeout and never retries', async () => {
    const { client, posted } = clientHarness()
    const result = client.listDirectory()
    const assertion = expect(result).rejects.toThrow('请求超时')
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)
    await assertion
    expect(client.pendingCount()).toBe(0)
    expect(posted).toHaveLength(1)
  })

  it('clears pending when postMessage throws', async () => {
    const { client } = clientHarness({ post: () => { throw new Error('post failed') } })
    await expect(client.listDirectory()).rejects.toThrow('post failed')
    expect(client.pendingCount()).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('caps concurrent pending requests', async () => {
    const { client } = clientHarness()
    const waiting = Array.from({ length: MAX_PENDING_REQUESTS }, () => client.listDirectory().catch(() => undefined))
    await expect(client.listDirectory()).rejects.toThrow('请求过多')
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)
    await Promise.all(waiting)
    expect(client.pendingCount()).toBe(0)
  })

  it('is unavailable when not a client or when the channel cannot connect', async () => {
    await expect(clientHarness({ isClient: false }).client.listDirectory()).rejects.toThrow('已关闭或不可用')
    await expect(clientHarness({ connect: false }).client.listDirectory()).rejects.toThrow('已关闭或不可用')
    await expect(clientHarness({ connect: false }).client.requestSnapshot()).rejects.toThrow('已关闭或不可用')
  })

  it('requestSnapshot returns the cached snapshot and posts nothing when not a client', async () => {
    const { client, posted } = clientHarness({ isClient: false })
    await expect(client.requestSnapshot()).resolves.toMatchObject({ status: 'idle' })
    expect(posted).toHaveLength(0)
  })

  it('caches a pushed snapshot and asks for notification', () => {
    const { client } = clientHarness()
    expect(client.receive({ version: 1, type: 'snapshot', sender: 'owner-1', snapshot })).toBe(true)
    expect(client.getSnapshot()).toBe(snapshot)
  })
})

describe('projection host', () => {
  it('answers snapshot requests only when owner, addressed to the requester', async () => {
    const { deps, posted } = hostHarness()
    await handleHostMessage(deps, { version: 1, type: 'snapshot-request', sender: 'client-1', id: 'x' })
    expect(posted).toEqual([{ version: 1, type: 'snapshot', sender: 'owner-1', target: 'client-1', snapshot }])
  })

  it('never publishes a snapshot when not owner', () => {
    const { deps, posted } = hostHarness({ isOwner: () => false })
    publishSnapshot(deps)
    publishSnapshot(deps, 'client-1')
    expect(posted).toHaveLength(0)
  })

  it('returns the listing addressed to the requester with the same id', async () => {
    const { deps, posted } = hostHarness()
    await handleHostMessage(deps, { version: 1, type: 'list-request', sender: 'client-1', id: 'req-1', path: '/a' })
    expect(posted).toEqual([{ version: 1, type: 'list-result', sender: 'owner-1', target: 'client-1', id: 'req-1', listing }])
  })

  it('returns a list failure as an error result', async () => {
    const { deps, posted } = hostHarness({ listDirectory: async () => { throw new Error('denied') } })
    await handleHostMessage(deps, { version: 1, type: 'list-request', sender: 'client-1', id: 'req-2' })
    expect(posted).toEqual([{ version: 1, type: 'list-result', sender: 'owner-1', target: 'client-1', id: 'req-2', error: 'denied' }])
  })

  it('uses a generic message for non-Error failures', async () => {
    const { deps, posted } = hostHarness({ listDirectory: async () => { throw 'x' } })
    await handleHostMessage(deps, { version: 1, type: 'list-request', sender: 'client-1', id: 'req-3' })
    expect(posted[0]).toMatchObject({ error: '目录投影读取失败。' })
  })

  it('ignores snapshot and list-result messages', async () => {
    const { deps, posted } = hostHarness()
    await handleHostMessage(deps, { version: 1, type: 'snapshot', sender: 'other', snapshot })
    await handleHostMessage(deps, { version: 1, type: 'list-result', sender: 'other', target: 'owner-1', id: 'x', listing })
    expect(posted).toHaveLength(0)
  })
})
