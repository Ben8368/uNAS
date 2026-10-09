import type { AuthorizedDirectoryListing, FileWorkspaceAccessSnapshot } from '#contracts'
import type { ProjectionMessage, RequestMessage } from './protocol'
import { MAX_MESSAGE_BYTES, MAX_PENDING_REQUESTS, REQUEST_TIMEOUT_MS } from './protocol'

type Pending = {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export class ProjectionClient {
  private readonly pending = new Map<string, Pending>()
  private sequence = 0
  private sender = ''
  private channel: BroadcastChannel | undefined

  setSender(sender: string) {
    this.sender = sender
  }

  setChannel(channel: BroadcastChannel | undefined) {
    this.channel = channel
  }

  get currentSnapshot(): FileWorkspaceAccessSnapshot {
    return this.clientSnapshot
  }

  private clientSnapshot: FileWorkspaceAccessSnapshot = {
    status: 'idle',
    message: '正在连接目录 Workspace。',
  }

  updateSnapshot(snapshot: FileWorkspaceAccessSnapshot) {
    this.clientSnapshot = snapshot
  }

  handleListResult(messageId: string, listing: AuthorizedDirectoryListing | undefined, error: string | undefined) {
    const request = this.pending.get(messageId)
    if (!request) return
    clearTimeout(request.timer)
    this.pending.delete(messageId)
    if (error) request.reject(new Error(error))
    else if (listing) request.resolve(listing)
    else request.reject(new Error('目录 Workspace 返回了无效的列表投影。'))
  }

  private request(message: RequestMessage): Promise<unknown> {
    if (!this.channel) return Promise.reject(new Error('目录 Workspace 已关闭或不可用；不会自动重放操作。请回到目录所有者页面后重试。'))
    if (this.pending.size >= MAX_PENDING_REQUESTS) return Promise.reject(new Error('目录 Workspace 请求过多，请稍后重试。'))
    const id = message.id
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error('目录 Workspace 请求超时；操作结果未确认，请刷新后再试。'))
      }, REQUEST_TIMEOUT_MS)
      this.pending.set(id, { resolve, reject, timer })
      try {
        const fullMessage = { ...message, version: 1, sender: this.sender } as ProjectionMessage
        if (JSON.stringify(fullMessage).length > MAX_MESSAGE_BYTES) throw new Error('目录 Workspace 消息超过本地预算。')
        this.channel!.postMessage(fullMessage)
      } catch (error) {
        clearTimeout(timer)
        this.pending.delete(id)
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }

  async requestSnapshot() {
    if (!this.channel) throw new Error('目录 Workspace 已关闭或不可用；不会自动重放操作。请回到目录所有者页面后重试。')
    const message: ProjectionMessage = { version: 1, type: 'snapshot-request', sender: this.sender, id: `${this.sender}:${++this.sequence}` }
    if (JSON.stringify(message).length > MAX_MESSAGE_BYTES) throw new Error('目录 Workspace 消息超过本地预算。')
    this.channel.postMessage(message)
    return this.clientSnapshot
  }

  async listDirectory(path?: string): Promise<AuthorizedDirectoryListing> {
    return await this.request({
      type: 'list-request',
      id: `${this.sender}:${++this.sequence}`,
      ...(path === undefined ? {} : { path }),
    }) as AuthorizedDirectoryListing
  }
}
