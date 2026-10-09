import { inlineWorkspace } from 'unas-src/platform/workspace/inlineWorkspace'
import * as directoryAdapter from '../real/fileWorkspace'
import { createProjectionClient } from './projection-client'
import { handleHostMessage, publishSnapshot, type ProjectionHostDeps } from './projection-host'
import { CHANNEL_NAME, MAX_MESSAGE_BYTES, validMessage, type ProjectionMessage } from './protocol'

let channel: BroadcastChannel | undefined
let self = ''
const listeners = new Set<() => void>()

export const isOwner = () => inlineWorkspace.getState() === 'owner'
export const isClient = () => inlineWorkspace.getState() === 'client'
const notify = () => { for (const listener of listeners) listener() }

function post(message: ProjectionMessage) {
  if (JSON.stringify(message).length > MAX_MESSAGE_BYTES) throw new Error('目录 Workspace 消息超过本地预算。')
  channel?.postMessage(message)
}

const host: ProjectionHostDeps = {
  self: () => self,
  isOwner,
  post,
  getSnapshot: () => directoryAdapter.getFileWorkspaceSnapshot(),
  listDirectory: (path) => directoryAdapter.listAuthorizedDirectory(path),
}
export const projectionClient = createProjectionClient({ self: () => self, isClient, connect: connectProjection, post })

async function receive(event: MessageEvent<unknown>) {
  if (!validMessage(event.data)) return
  const message = event.data
  if (message.sender === self || ('target' in message && message.target && message.target !== self)) return
  if (isOwner()) { await handleHostMessage(host, message); return }
  if (!isClient()) return
  if (projectionClient.receive(message)) notify()
}

/** Creates the shared channel once. Returns false when BroadcastChannel is unavailable. */
export function connectProjection(): boolean {
  if (channel) return true
  if (typeof BroadcastChannel === 'undefined') return false
  self = crypto.randomUUID()
  channel = new BroadcastChannel(CHANNEL_NAME)
  channel.onmessage = (event) => { void receive(event) }
  directoryAdapter.subscribeFileWorkspace(() => { publishSnapshot(host); notify() })
  inlineWorkspace.subscribe(() => {
    if (isOwner()) publishSnapshot(host)
    else if (isClient()) void projectionClient.requestSnapshot().catch(() => undefined)
    notify()
  })
  publishSnapshot(host)
  return true
}

export function subscribeProjection(listener: () => void) {
  connectProjection()
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
