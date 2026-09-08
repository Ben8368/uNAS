import type { AuthorizedDirectoryListing, FileEntry, FileWorkspaceAccessSnapshot } from '#contracts'
import type { ResourceGrant } from '#contracts'

const DATABASE_NAME = 'unas-file-workspace-v1'
const STORE_NAME = 'directory-grants'
// Preserve the existing storage key so previously selected directories still restore.
const RECORD_KEY = 'active-read-directory'
const ENTRY_LIMIT = 200

type FsaPermission = 'granted' | 'denied' | 'prompt'
type FsaHandle = { kind: 'file' | 'directory'; name: string }
type FsaFileHandle = FsaHandle & {
  kind: 'file'
  getFile(): Promise<File>
  createWritable(): Promise<{ write(data: string | Blob): Promise<void>; close(): Promise<void>; abort?(): Promise<void> }>
}
type FsaDirectoryHandle = FsaHandle & {
  kind: 'directory'
  queryPermission(options?: { mode?: 'read' | 'readwrite' }): Promise<FsaPermission>
  requestPermission?(options?: { mode?: 'read' | 'readwrite' }): Promise<FsaPermission>
  entries(): AsyncIterableIterator<[string, FsaHandle]>
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FsaFileHandle>
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FsaDirectoryHandle>
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>
}
type DirectoryPicker = (options?: { mode?: 'read' | 'readwrite' }) => Promise<FsaDirectoryHandle>
type StoredDirectoryGrant = { schemaVersion: 1; id: string; createdAt: number; handle: FsaDirectoryHandle }
type Route = { handle: FsaDirectoryHandle; names: string[] }

let active: StoredDirectoryGrant | undefined
let routes = new Map<string, Route>()
let snapshot: FileWorkspaceAccessSnapshot = { status: 'idle' }
let restoring: Promise<FileWorkspaceAccessSnapshot> | undefined
const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

function setSnapshot(next: FileWorkspaceAccessSnapshot) {
  snapshot = next
  notify()
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME)
    request.onerror = () => reject(request.error ?? new Error('无法打开目录授权存储。'))
    request.onsuccess = () => resolve(request.result)
  })
}

async function readStoredGrant(): Promise<StoredDirectoryGrant | undefined> {
  const database = await openDatabase()
  try {
    return await new Promise<StoredDirectoryGrant | undefined>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(RECORD_KEY)
      request.onerror = () => reject(request.error ?? new Error('无法读取目录授权。'))
      request.onsuccess = () => resolve(request.result as StoredDirectoryGrant | undefined)
    })
  } finally { database.close() }
}

async function writeStoredGrant(grant: StoredDirectoryGrant) {
  const database = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put(grant, RECORD_KEY)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('无法保存目录授权。'))
      transaction.onabort = () => reject(transaction.error ?? new Error('保存目录授权已中止。'))
    })
  } finally { database.close() }
}

async function removeStoredGrant() {
  const database = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).delete(RECORD_KEY)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('无法清除目录授权。'))
      transaction.onabort = () => reject(transaction.error ?? new Error('清除目录授权已中止。'))
    })
  } finally { database.close() }
}

function routePath(names: string[]) {
  return names.length === 0 ? '/' : `/${names.map(encodeURIComponent).join('/')}`
}

function routeFor(path: string) {
  const route = routes.get(path)
  if (!route) throw new Error('目录不属于当前授权范围，请返回已授权目录后重试。')
  return route
}

function currentGrant(): ResourceGrant | undefined {
  if (!active) return undefined
  return {
    id: active.id,
    kind: snapshot.writeAccess === 'granted' ? 'dir.write' : 'dir.read',
    status: snapshot.status === 'ready' ? 'active' : 'revoked',
    displayName: active.handle.name,
    createdAt: active.createdAt,
    updatedAt: Date.now(),
    // Directory handles have revocable browser permissions rather than a fixed expiry.
    expiresAt: Number.MAX_SAFE_INTEGER,
  }
}

function resetRoutes(handle: FsaDirectoryHandle) {
  routes = new Map([['/', { handle, names: [] }]])
}

async function hasReadPermission(handle: FsaDirectoryHandle) {
  return await handle.queryPermission({ mode: 'read' }) === 'granted'
}

async function writeAccessFor(handle: FsaDirectoryHandle) {
  try {
    return await handle.queryPermission({ mode: 'readwrite' }) === 'granted' ? 'granted' : 'requires-user'
  } catch {
    return 'unavailable'
  }
}

function readySnapshotWithWriteAccess(grant: StoredDirectoryGrant, writeAccess: 'granted' | 'requires-user' | 'unavailable', message: string): FileWorkspaceAccessSnapshot {
  return { status: 'ready', grantId: grant.id, displayName: grant.handle.name, writeAccess, message }
}

async function requireReadableDirectory() {
  if (!active) throw new Error('尚未授权本地目录。')
  if (!await hasReadPermission(active.handle)) {
    setSnapshot({ status: 'requires-user', grantId: active.id, displayName: active.handle.name, message: '目录授权已失效。请重新选择目录；uNAS 不会自动请求权限。' })
    throw new Error('目录授权已失效，请重新选择目录。')
  }
}

async function requireWritableDirectory() {
  await requireReadableDirectory()
  if (!active) throw new Error('尚未授权本地目录。')
  if (snapshot.writeAccess !== 'granted' || await writeAccessFor(active.handle) !== 'granted') {
    setSnapshot(readySnapshotWithWriteAccess(active, 'requires-user', '当前目录为只读。请在窗口顶部点击“只读”开启写入模式。'))
    throw new Error('当前目录尚未启用写入模式。')
  }
}

function validEntryName(value: string) {
  const name = value.trim()
  if (!name || name === '.' || name === '..' || name.length > 120 || /[\\/\0]/.test(name)) {
    throw new Error('名称不能为空，且不能包含路径分隔符或控制字符。')
  }
  return name
}

async function ensureEntryAbsent(directory: FsaDirectoryHandle, name: string) {
  const absentForKind = (error: unknown) => error instanceof DOMException && ['NotFoundError', 'TypeMismatchError'].includes(error.name)
  const fileExists = await directory.getFileHandle(name).then(() => true, (error) => {
    if (absentForKind(error)) return false
    throw error
  })
  if (fileExists) throw new Error(`“${name}”已存在，未覆盖现有文件。`)
  const directoryExists = await directory.getDirectoryHandle(name).then(() => true, (error) => {
    if (absentForKind(error)) return false
    throw error
  })
  if (directoryExists) throw new Error(`“${name}”已存在，未覆盖现有文件夹。`)
}

function extensionOf(name: string) {
  const index = name.lastIndexOf('.')
  return index > 0 ? name.slice(index + 1).toLowerCase() : undefined
}

async function entryFor(name: string, handle: FsaHandle, route: Route): Promise<FileEntry> {
  const path = routePath([...route.names, name])
  if (handle.kind === 'directory') {
    routes.set(path, { handle: handle as FsaDirectoryHandle, names: [...route.names, name] })
    return { executionSource: 'real', name, path, size: 0, modified: '', type: 'directory' }
  }
  const file = await (handle as FsaFileHandle).getFile()
  return {
    executionSource: 'real',
    name,
    path,
    size: file.size,
    modified: new Date(file.lastModified).toISOString(),
    type: 'file',
    extension: extensionOf(name),
  }
}

function isAbort(error: unknown) {
  return Boolean(error && typeof error === 'object' && (error as { name?: unknown }).name === 'AbortError')
}

export function subscribeFileWorkspace(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function getFileWorkspaceSnapshot() {
  return snapshot
}

export function getActiveDirectoryGrant() {
  return currentGrant()
}

/** Called only from a user gesture. It opens a native read-only directory picker. */
export async function authorizeFileManagerDirectory() {
  const picker = (globalThis as typeof globalThis & { showDirectoryPicker?: DirectoryPicker }).showDirectoryPicker
  if (typeof picker !== 'function') {
    setSnapshot({ status: 'unavailable', message: '此浏览器页面不提供目录选择器；演示数据保持不读取本地文件。' })
    return snapshot
  }
  setSnapshot({ status: 'selecting', message: '正在等待目录选择。' })
  try {
    const handle = await picker({ mode: 'read' })
    if (!await hasReadPermission(handle)) throw new Error('浏览器未授予所选目录的读取权限。')
    const next: StoredDirectoryGrant = { schemaVersion: 1, id: crypto.randomUUID(), createdAt: Date.now(), handle }
    await writeStoredGrant(next)
    active = next
    resetRoutes(handle)
    setSnapshot(readySnapshotWithWriteAccess(next, 'requires-user', '已授权读取；需要写入时请在窗口顶部开启写入模式。'))
  } catch (error) {
    if (isAbort(error)) {
      if (active && await hasReadPermission(active.handle)) {
        const writeAccess = snapshot.writeAccess === 'granted' && await writeAccessFor(active.handle) === 'granted' ? 'granted' : 'requires-user'
        setSnapshot(readySnapshotWithWriteAccess(active, writeAccess, '未更换目录，继续使用已有目录授权。'))
      }
      else setSnapshot({ status: 'idle', message: '未选择本地目录；演示数据保持不读取本地文件。' })
    } else {
      setSnapshot({ status: 'error', message: error instanceof Error ? error.message : '目录授权失败。' })
    }
  }
  return snapshot
}

/** Restore only previously granted handles. It never shows a permission prompt. */
export async function restoreFileManagerDirectory() {
  if (snapshot.status === 'selecting') return snapshot
  if (restoring) return await restoring
  restoring = restoreDirectoryGrant()
  try { return await restoring }
  finally { restoring = undefined }
}

async function restoreDirectoryGrant(): Promise<FileWorkspaceAccessSnapshot> {
  if (active && await hasReadPermission(active.handle)) {
    resetRoutes(active.handle)
    setSnapshot(readySnapshotWithWriteAccess(active, 'requires-user', '已恢复先前的目录授权；不会在后台请求写入权限。'))
    return snapshot
  }
  try {
    const stored = await readStoredGrant()
    if (!stored) return snapshot
    if (snapshot.status === 'selecting') return snapshot
    active = stored
    if (await hasReadPermission(stored.handle)) {
      resetRoutes(stored.handle)
      setSnapshot(readySnapshotWithWriteAccess(stored, 'requires-user', '已恢复先前的目录授权；不会在后台请求写入权限。'))
    } else {
      setSnapshot({ status: 'requires-user', grantId: stored.id, displayName: stored.handle.name, message: '已保存的目录授权需要重新选择；uNAS 不会在后台请求权限。' })
    }
  } catch (error) {
    setSnapshot({ status: 'error', message: error instanceof Error ? error.message : '无法恢复目录授权。' })
  }
  return snapshot
}

export async function listAuthorizedDirectory(path = '/'): Promise<AuthorizedDirectoryListing> {
  await requireReadableDirectory()
  const route = routeFor(path)
  const entries: Array<[string, FsaHandle]> = []
  let truncated = false
  for await (const entry of route.handle.entries()) {
    if (entries.length >= ENTRY_LIMIT) { truncated = true; break }
    entries.push(entry)
  }
  entries.sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }))
  const directories: FileEntry[] = []
  const files: FileEntry[] = []
  for (const [name, handle] of entries) {
    const entry = await entryFor(name, handle, route)
    if (entry.type === 'directory') directories.push(entry)
    else files.push(entry)
  }
  const displayPath = [active!.handle.name, ...route.names].join(' / ')
  return { ok: true, executionSource: 'real', path, displayPath, directories, files, truncated }
}

/** Only call from an explicit confirmation. Restore and directory listing never request write permission. */
export async function requestFileManagerDirectoryWriteAccess() {
  await requireReadableDirectory()
  if (!active) throw new Error('尚未授权本地目录。')
  if (snapshot.writeAccess === 'granted' && await writeAccessFor(active.handle) === 'granted') {
    setSnapshot(readySnapshotWithWriteAccess(active, 'granted', '写入模式已开启。所有写入操作仍需由你明确触发。'))
    return snapshot
  }
  if (typeof active.handle.requestPermission !== 'function') {
    setSnapshot(readySnapshotWithWriteAccess(active, 'unavailable', '此浏览器未提供目录写入授权接口；当前目录保持只读。'))
    throw new Error('此浏览器未提供目录写入授权接口。')
  }
  try {
    const permission = await active.handle.requestPermission({ mode: 'readwrite' })
    if (permission !== 'granted') {
      setSnapshot(readySnapshotWithWriteAccess(active, 'requires-user', '浏览器未授予写入权限；当前目录保持只读。'))
      throw new Error('浏览器未授予目录写入权限。')
    }
    setSnapshot(readySnapshotWithWriteAccess(active, 'granted', '写入模式已开启。所有写入操作仍需由你明确触发。'))
  } catch (error) {
    if (snapshot.writeAccess === 'granted') throw error
    setSnapshot(readySnapshotWithWriteAccess(active, 'requires-user', '未开启写入模式；当前目录保持只读。'))
    throw error
  }
  return snapshot
}

/** Locks writing in uNAS only. It never revokes the browser's directory grant. */
export function disableFileManagerDirectoryWriteAccess() {
  if (!active || snapshot.status !== 'ready') return snapshot
  setSnapshot(readySnapshotWithWriteAccess(active, 'requires-user', '写入模式已关闭；当前目录恢复为只读。'))
  return snapshot
}

export async function createAuthorizedDirectory(path: string, requestedName: string) {
  await requireWritableDirectory()
  const name = validEntryName(requestedName)
  const route = routeFor(path)
  await ensureEntryAbsent(route.handle, name)
  await route.handle.getDirectoryHandle(name, { create: true })
}

export async function createAuthorizedMarkdownFile(path: string, requestedName: string) {
  await requireWritableDirectory()
  const baseName = validEntryName(requestedName)
  const name = baseName.toLowerCase().endsWith('.md') ? baseName : `${baseName}.md`
  const route = routeFor(path)
  await ensureEntryAbsent(route.handle, name)
  const file = await route.handle.getFileHandle(name, { create: true })
  const writable = await file.createWritable()
  try {
    await writable.write('# 新文档\n')
    await writable.close()
  } catch (error) {
    await writable.abort?.()
    throw error
  }
}

/** Deletes a single, explicitly named direct child; directories are never recursively deleted. */
export async function deleteAuthorizedDirectoryEntry(path: string, requestedName: string) {
  await requireWritableDirectory()
  const name = validEntryName(requestedName)
  await routeFor(path).handle.removeEntry(name, { recursive: false })
}

export async function forgetFileManagerDirectory() {
  await removeStoredGrant()
  active = undefined
  routes = new Map()
  setSnapshot({ status: 'idle', message: '已清除保存的目录授权；未删除任何本地文件。' })
}
