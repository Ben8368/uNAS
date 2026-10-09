import type { AuthorizedDirectoryListing, FileWorkspaceAccessSnapshot } from '#contracts'
import { MAX_PENDING_REQUESTS, REQUEST_TIMEOUT_MS, type ProjectionMessage } from './protocol'

type Pending = { resolve: (value: AuthorizedDirectoryListing) => void; reject: (reason: Error) => void; timer: ReturnType<typeof setTimeout> }

export type ProjectionClientDeps = {
  self: () => string
  isClient: () => boolean
  /** Ensures the transport exists; false when this context has no BroadcastChannel. */
  connect: () => boolean
  post: (message: ProjectionMessage) => void
}

export function workspaceUnavailable() {
  return new Error('目录 Workspace 已关闭或不可用；不会自动重放操作。请回到目录所有者页面后重试。')
}

/** Read-only client side of the projection: list requests, snapshot cache and request correlation. */
export function createProjectionClient(deps: ProjectionClientDeps) {
  const pending = new Map<string, Pending>()
  let sequence = 0
  let snapshot: FileWorkspaceAccessSnapshot = { status: 'idle', message: '正在连接目录 Workspace。' }

  function request(id: string, path: string | undefined): Promise<AuthorizedDirectoryListing> {
    if (!deps.connect() || !deps.isClient()) return Promise.reject(workspaceUnavailable())
    if (pending.size >= MAX_PENDING_REQUESTS) return Promise.reject(new Error('目录 Workspace 请求过多，请稍后重试。'))
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('目录 Workspace 请求超时；操作结果未确认，请刷新后再试。')) }, REQUEST_TIMEOUT_MS)
      pending.set(id, { resolve, reject, timer })
      try { deps.post({ version: 1, type: 'list-request', sender: deps.self(), id, ...(path === undefined ? {} : { path }) }) }
      catch (error) { clearTimeout(timer); pending.delete(id); reject(error instanceof Error ? error : new Error(String(error))) }
    })
  }

  return {
    getSnapshot: () => snapshot,
    pendingCount: () => pending.size,
    listDirectory: (path?: string) => request(`${deps.self()}:${++sequence}`, path),
    async requestSnapshot() {
      if (!deps.isClient()) return snapshot
      if (!deps.connect()) throw workspaceUnavailable()
      deps.post({ version: 1, type: 'snapshot-request', sender: deps.self(), id: `${deps.self()}:${++sequence}` })
      return snapshot
    },
    /** Returns true when the cached snapshot changed and subscribers should be notified. */
    receive(message: ProjectionMessage): boolean {
      if (message.type === 'snapshot') { snapshot = message.snapshot; return true }
      if (message.type !== 'list-result') return false
      const waiting = pending.get(message.id)
      if (!waiting) return false
      clearTimeout(waiting.timer); pending.delete(message.id)
      if (message.error) waiting.reject(new Error(message.error))
      else if (message.listing) waiting.resolve(message.listing)
      else waiting.reject(new Error('目录 Workspace 返回了无效的列表投影。'))
      return false
    },
  }
}
