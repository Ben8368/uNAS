import type { AuthorizedDirectoryListing, FileEntry, FileWorkspaceAccessSnapshot } from '#contracts'
import { inlineWorkspace } from 'unas-src/runtime/inlineWorkspace'
import * as directoryAdapter from './real/fileWorkspace'

const CHANNEL_NAME = 'unas-file-workspace-projection-v1'
const MAX_MESSAGE_BYTES = 200_000
const REQUEST_TIMEOUT_MS = 5_000
const MAX_PENDING_REQUESTS = 16

type ProjectionMessage =
  | { version: 1; type: 'snapshot-request'; sender: string; id: string }
  | { version: 1; type: 'list-request'; sender: string; id: string; path?: string }
  | { version: 1; type: 'snapshot'; sender: string; target?: string; snapshot: FileWorkspaceAccessSnapshot }
  | { version: 1; type: 'list-result'; sender: string; target: string; id: string; listing?: AuthorizedDirectoryListing; error?: string }
type RequestMessage =
  | { type: 'snapshot-request'; id: string }
  | { type: 'list-request'; id: string; path?: string }
type Pending = { resolve: (value: unknown) => void; reject: (reason: Error) => void; timer: ReturnType<typeof setTimeout> }

let channel: BroadcastChannel | undefined
let self = ''
let sequence = 0
let clientSnapshot: FileWorkspaceAccessSnapshot = { status: 'idle', message: '正在连接目录 Workspace。' }
const unavailableSnapshot: FileWorkspaceAccessSnapshot = { status: 'requires-user', message: '目录 Workspace 已关闭或不可用；不会自动恢复目录操作。' }
const listeners = new Set<() => void>()
const pending = new Map<string, Pending>()

const string = (value: unknown) => typeof value === 'string' && value.length <= 4096
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const isOwner = () => inlineWorkspace.getState() === 'owner'
const isClient = () => inlineWorkspace.getState() === 'client'

function requiresOwner() {
  return new Error('此页面只显示由另一个 Workspace 管理的目录投影。请回到目录所有者页面执行授权或写入操作。')
}
function workspaceUnavailable() {
  return new Error('目录 Workspace 已关闭或不可用；不会自动重放操作。请回到目录所有者页面后重试。')
}
function notify() { for (const listener of listeners) listener() }

function validSnapshot(value: unknown): value is FileWorkspaceAccessSnapshot {
  if (!object(value) || !['idle', 'selecting', 'ready', 'requires-user', 'unavailable', 'error'].includes(String(value.status))) return false
  if (value.grantId !== undefined && !string(value.grantId)) return false
  if (value.displayName !== undefined && !string(value.displayName)) return false
  if (value.message !== undefined && !string(value.message)) return false
  return value.writeAccess === undefined || ['granted', 'requires-user', 'unavailable'].includes(String(value.writeAccess))
}
function validEntry(value: unknown): value is FileEntry {
  return object(value) && value.executionSource === 'real' && string(value.name) && string(value.path) && typeof value.size === 'number' &&
    typeof value.modified === 'string' && ['file', 'directory'].includes(String(value.type)) && (value.extension === undefined || string(value.extension))
}
function validListing(value: unknown): value is AuthorizedDirectoryListing {
  return object(value) && value.ok === true && value.executionSource === 'real' && string(value.path) && string(value.displayPath) &&
    typeof value.truncated === 'boolean' && Array.isArray(value.directories) && value.directories.length <= 200 && value.directories.every(validEntry) &&
    Array.isArray(value.files) && value.files.length <= 200 && value.files.every(validEntry)
}
function validMessage(value: unknown): value is ProjectionMessage {
  if (!object(value) || value.version !== 1 || !string(value.sender) || !value.sender) return false
  try { if (JSON.stringify(value).length > MAX_MESSAGE_BYTES) return false } catch { return false }
  if (value.type === 'snapshot-request') return string(value.id) && Object.keys(value).length === 4
  if (value.type === 'list-request') return string(value.id) && (value.path === undefined || string(value.path)) && Object.keys(value).every((key) => ['version', 'type', 'sender', 'id', 'path'].includes(key))
  if (value.type === 'snapshot') return validSnapshot(value.snapshot) && (value.target === undefined || string(value.target)) && Object.keys(value).every((key) => ['version', 'type', 'sender', 'target', 'snapshot'].includes(key))
  return string(value.target) && string(value.id) && (value.listing === undefined || validListing(value.listing)) && (value.error === undefined || string(value.error)) && Object.keys(value).every((key) => ['version', 'type', 'sender', 'target', 'id', 'listing', 'error'].includes(key))
}

function post(message: ProjectionMessage) {
  if (JSON.stringify(message).length > MAX_MESSAGE_BYTES) throw new Error('目录 Workspace 消息超过本地预算。')
  channel?.postMessage(message)
}
function publishSnapshot(target?: string) {
  if (!isOwner()) return
  post({ version: 1, type: 'snapshot', sender: self, ...(target ? { target } : {}), snapshot: directoryAdapter.getFileWorkspaceSnapshot() })
}

async function receive(event: MessageEvent<unknown>) {
  if (!validMessage(event.data)) return
  const message = event.data
  if (message.sender === self || ('target' in message && message.target && message.target !== self)) return
  if (isOwner()) {
    if (message.type === 'snapshot-request') { publishSnapshot(message.sender); return }
    if (message.type !== 'list-request') return
    try {
      const listing = await directoryAdapter.listAuthorizedDirectory(message.path)
      post({ version: 1, type: 'list-result', sender: self, target: message.sender, id: message.id, listing })
    } catch (error) {
      post({ version: 1, type: 'list-result', sender: self, target: message.sender, id: message.id, error: error instanceof Error ? error.message : '目录投影读取失败。' })
    }
    return
  }
  if (!isClient()) return
  if (message.type === 'snapshot') { clientSnapshot = message.snapshot; notify(); return }
  if (message.type !== 'list-result') return
  const request = pending.get(message.id)
  if (!request) return
  clearTimeout(request.timer); pending.delete(message.id)
  if (message.error) request.reject(new Error(message.error))
  else if (message.listing) request.resolve(message.listing)
  else request.reject(new Error('目录 Workspace 返回了无效的列表投影。'))
}

function ensureChannel() {
  if (channel || typeof BroadcastChannel === 'undefined') return
  self = crypto.randomUUID()
  channel = new BroadcastChannel(CHANNEL_NAME)
  channel.onmessage = (event) => { void receive(event) }
  directoryAdapter.subscribeFileWorkspace(() => { publishSnapshot(); notify() })
  inlineWorkspace.subscribe(() => {
    if (isOwner()) publishSnapshot()
    else if (isClient()) void requestSnapshot().catch(() => undefined)
    notify()
  })
  if (isOwner()) publishSnapshot()
}

function request(message: RequestMessage): Promise<unknown> {
  ensureChannel()
  if (!channel || !isClient()) return Promise.reject(workspaceUnavailable())
  if (pending.size >= MAX_PENDING_REQUESTS) return Promise.reject(new Error('目录 Workspace 请求过多，请稍后重试。'))
  const id = message.id
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('目录 Workspace 请求超时；操作结果未确认，请刷新后再试。')) }, REQUEST_TIMEOUT_MS)
    pending.set(id, { resolve, reject, timer })
    try { post({ ...message, version: 1, sender: self } as ProjectionMessage) }
    catch (error) { clearTimeout(timer); pending.delete(id); reject(error instanceof Error ? error : new Error(String(error))) }
  })
}
async function requestSnapshot() {
  if (!isClient()) return clientSnapshot
  ensureChannel()
  if (!channel) throw workspaceUnavailable()
  post({ version: 1, type: 'snapshot-request', sender: self, id: `${self}:${++sequence}` })
  return clientSnapshot
}
function currentSnapshot(): FileWorkspaceAccessSnapshot {
  if (isOwner()) return directoryAdapter.getFileWorkspaceSnapshot()
  if (isClient()) return clientSnapshot
  return unavailableSnapshot
}

/** The only File Workspace surface available to React screens. */
export const fileWorkspacePort = Object.freeze({
  canManageDirectory: isOwner,
  chooseDirectory: async () => { if (!isOwner()) throw requiresOwner(); return await directoryAdapter.authorizeFileManagerDirectory() },
  forgetDirectory: async () => { if (!isOwner()) throw requiresOwner(); return await directoryAdapter.forgetFileManagerDirectory() },
  getSnapshot: currentSnapshot,
  listDirectory: async (path?: string) => {
    if (isOwner()) return await directoryAdapter.listAuthorizedDirectory(path)
    if (!isClient()) throw workspaceUnavailable()
    return await request({ type: 'list-request', id: `${self}:${++sequence}`, ...(path === undefined ? {} : { path }) }) as AuthorizedDirectoryListing
  },
  requestWriteAccess: async () => { if (!isOwner()) throw requiresOwner(); return await directoryAdapter.requestFileManagerDirectoryWriteAccess() },
  restoreDirectory: async () => {
    ensureChannel()
    if (isOwner()) return await directoryAdapter.restoreFileManagerDirectory()
    if (isClient()) return await requestSnapshot()
    return currentSnapshot()
  },
  subscribe: (listener: () => void) => { ensureChannel(); listeners.add(listener); return () => { listeners.delete(listener) } },
  createDirectory: async (path: string, name: string) => { if (!isOwner()) throw requiresOwner(); return await directoryAdapter.createAuthorizedDirectory(path, name) },
  createMarkdownFile: async (path: string, name: string) => { if (!isOwner()) throw requiresOwner(); return await directoryAdapter.createAuthorizedMarkdownFile(path, name) },
  extractZip: async (path: string, name: string) => { if (!isOwner()) throw requiresOwner(); return await directoryAdapter.extractAuthorizedZip(path, name) },
  cancelZipExtraction: () => { if (!isOwner()) throw requiresOwner(); return directoryAdapter.cancelAuthorizedZipExtraction() },
  deleteEntry: async (path: string, name: string) => { if (!isOwner()) throw requiresOwner(); return await directoryAdapter.deleteAuthorizedDirectoryEntry(path, name) },
  disableWriteAccess: () => { if (!isOwner()) throw requiresOwner(); return directoryAdapter.disableFileManagerDirectoryWriteAccess() },
})
