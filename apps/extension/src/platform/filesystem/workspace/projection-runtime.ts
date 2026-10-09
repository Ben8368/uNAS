import { inlineWorkspace } from 'unas-src/platform/workspace/inlineWorkspace'
import type { ProjectionMessage } from './protocol'
import { CHANNEL_NAME, validMessage } from './protocol'
import { publishSnapshot, handleListRequest } from './projection-host'
import type { ProjectionClient } from './projection-client'
import * as directoryAdapter from '../real/fileWorkspace'

export class ProjectionRuntime {
  private channel: BroadcastChannel | undefined
  private self = ''
  private readonly listeners = new Set<() => void>()
  private client: ProjectionClient | undefined

  private isOwner() {
    return inlineWorkspace.getState() === 'owner'
  }

  private isClient() {
    return inlineWorkspace.getState() === 'client'
  }

  private async receive(event: MessageEvent<unknown>) {
    if (!validMessage(event.data)) return
    const message = event.data
    if (message.sender === this.self || ('target' in message && message.target && message.target !== this.self)) return

    if (this.isOwner()) {
      if (message.type === 'snapshot-request') {
        publishSnapshot(this.channel, this.self, message.sender)
        return
      }
      if (message.type !== 'list-request') return
      await handleListRequest(this.channel, this.self, message.sender, message.id, message.path)
      return
    }

    if (!this.isClient() || !this.client) return
    if (message.type === 'snapshot') {
      this.client.updateSnapshot(message.snapshot)
      this.notify()
      return
    }
    if (message.type !== 'list-result') return
    this.client.handleListResult(message.id, message.listing, message.error)
  }

  private notify() {
    for (const listener of this.listeners) listener()
  }

  ensureChannel(client: ProjectionClient) {
    if (this.channel || typeof BroadcastChannel === 'undefined') {
      this.client = client
      client.setChannel(this.channel)
      client.setSender(this.self)
      return
    }
    this.self = crypto.randomUUID()
    this.channel = new BroadcastChannel(CHANNEL_NAME)
    this.channel.onmessage = (event) => { void this.receive(event) }
    this.client = client
    client.setChannel(this.channel)
    client.setSender(this.self)

    directoryAdapter.subscribeFileWorkspace(() => {
      publishSnapshot(this.channel, this.self)
      this.notify()
    })

    inlineWorkspace.subscribe(() => {
      if (this.isOwner()) publishSnapshot(this.channel, this.self)
      else if (this.isClient() && this.client) void this.client.requestSnapshot().catch(() => undefined)
      this.notify()
    })

    if (this.isOwner()) publishSnapshot(this.channel, this.self)
  }

  get channelId(): string {
    return this.self
  }

  get broadcastChannel(): BroadcastChannel | undefined {
    return this.channel
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
}
