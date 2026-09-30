import type { DavConnectionInput, DavDirectoryListing, DavFileEntry } from '#contracts'
import { WebDavClient } from 'unas-src/runtime/webdav/client'
import { davName, davPath, parseDavListing } from 'unas-src/runtime/webdav/listing'
import { normalizeWebDavUrl, webDavPermissionOrigin } from 'unas-src/shared/webdav-url'
import { extensionApi } from 'unas-src/runtime/extensionPlatform'
import { offerFileExport, requireExtensionFiles, selectOneFile } from './fileManagerIO'

const maxFileBytes = 16 * 1024 * 1024
const propfind = new TextEncoder().encode('<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:getcontentlength/><d:getlastmodified/><d:getetag/></d:prop></d:propfind>')

function expectStatus(status: number, allowed: number[]) {
  if (allowed.includes(status)) return
  if ([405, 409, 412].includes(status)) throw new Error('目标已存在、目录已变化或版本冲突；请刷新，未自动覆盖或重试。')
  if (status === 423) throw new Error('远端文件已锁定，请在服务器解除锁定后重试。')
  if (status === 507) throw new Error('WebDAV 服务器空间不足。')
  throw new Error(`WebDAV 文件请求失败（HTTP ${status}）。`)
}

export function createDavFilesPort() {
  let client: WebDavClient | undefined
  let controller: AbortController | undefined
  let listing: DavDirectoryListing | undefined
  const knownDirectories = new Set([''])
  let generation = 0

  async function operation<T>(mutating: boolean, action: (current: WebDavClient, signal: AbortSignal) => Promise<T>): Promise<T> {
    requireExtensionFiles()
    if (!client) throw new Error('请先连接 WebDAV 文件服务器。')
    if (controller) throw new Error('已有文件操作正在执行，请先完成或取消。')
    const current = client
    const pending = new AbortController()
    controller = pending
    try {
      if (!await extensionApi()?.permissions?.contains({ origins: [webDavPermissionOrigin(current.endpoint)] })) throw new Error('WebDAV 主机权限已撤销，请重新连接。')
      pending.signal.throwIfAborted()
      if (!mutating) return await action(current, pending.signal)
      if (typeof navigator.locks?.request !== 'function') throw new Error('浏览器缺少文件操作锁，当前连接不能写入。')
      return await navigator.locks.request(`unas-dav-files:${current.endpoint}`, { ifAvailable: true }, async lock => {
        if (!lock) throw new Error('另一个页面正在操作此 WebDAV 目录，请稍后重试。')
        pending.signal.throwIfAborted()
        return await action(current, pending.signal)
      })
    } catch (error) {
      if (mutating && (pending.signal.aborted || (error instanceof Error && /网络请求|超时/.test(error.message)))) throw new Error('请求已停止，远端写入结果尚未确认。请刷新目录核对；不会自动重试。', { cause: error })
      if (pending.signal.aborted) throw new Error('WebDAV 请求已取消。', { cause: error })
      throw error
    } finally { if (controller === pending) controller = undefined }
  }

  async function readList(current: WebDavClient, path: string, signal: AbortSignal) {
    davPath(path)
    const response = await current.request('PROPFIND', path, { headers: { Depth: '1', 'Content-Type': 'application/xml; charset=utf-8' }, body: propfind, signal, readBody: true, maxResponseBytes: 1024 * 1024 })
    expectStatus(response.status, [207])
    return parseDavListing(new TextDecoder().decode(response.data), current.endpoint, path)
  }
  function directory(path: string) {
    davPath(path)
    if (!knownDirectories.has(path)) throw new Error('目录不属于当前连接已读取的范围。')
  }
  function file(path: string): DavFileEntry {
    const entry = listing?.entries.find(item => item.path === path && item.type === 'file')
    if (!entry) throw new Error('请选择当前列表中的文件；目录不允许递归删除或下载。')
    return entry
  }
  return Object.freeze({
    async connect(input: DavConnectionInput, signal?: AbortSignal) {
      requireExtensionFiles()
      if (!input.consent) throw new Error('请确认允许连接文件服务器。')
      if (controller) throw new Error('已有 WebDAV 操作正在执行。')
      if (client) throw new Error('请先断开已有文件连接。')
      const endpoint = normalizeWebDavUrl(input.endpoint)
      const candidate = new WebDavClient(endpoint, input.username, input.appPassword, { maxBytes: maxFileBytes })
      const ticket = ++generation
      const permission = extensionApi()?.permissions
      if (!permission) throw new Error('浏览器未开放可选主机权限申请。')
      const pending = new AbortController()
      controller = pending
      const requestSignal = signal ? AbortSignal.any([signal, pending.signal]) : pending.signal
      try {
        // Request immediately in the click/submit gesture, before any asynchronous work.
        const granted = await permission.request({ origins: [webDavPermissionOrigin(endpoint)] })
        if (ticket !== generation || requestSignal.aborted) throw new Error('已取消连接。')
        if (!granted) throw new Error('未授予 WebDAV 主机权限，连接已取消。')
        const result = await readList(candidate, '', requestSignal)
        if (ticket !== generation) throw new Error('已取消连接。')
        client = candidate
        listing = result
        knownDirectories.clear(); knownDirectories.add('')
        for (const entry of result.entries) if (entry.type === 'directory') knownDirectories.add(entry.path)
        return { endpoint, listing: result }
      } catch (error) { if (ticket === generation) client = undefined; throw error }
      finally { if (controller === pending) controller = undefined }
    },
    async list(path: string) {
      directory(path)
      return await operation(false, async (current, signal) => {
        const result = await readList(current, path, signal)
        listing = result
        for (const entry of result.entries) if (entry.type === 'directory') knownDirectories.add(entry.path)
        return result
      })
    },
    async createDirectory(path: string, name: string) {
      directory(path); davName(name)
      await operation(true, async (current, signal) => {
        const response = await current.request('MKCOL', `${path}${encodeURIComponent(name)}/`, { signal, headers: { 'If-None-Match': '*' } })
        expectStatus(response.status, [201])
      })
    },
    async upload(path: string) {
      directory(path)
      const selected = await selectOneFile()
      if (!selected) return false
      davName(selected.name)
      if (selected.size > maxFileBytes) throw new Error('本次上传超过 16 MiB 文件预算。')
      await operation(true, async (current, signal) => {
        const data = new Uint8Array(await selected.arrayBuffer())
        signal.throwIfAborted()
        const response = await current.request('PUT', `${path}${encodeURIComponent(selected.name)}`, { signal, body: data, headers: { 'If-None-Match': '*', 'Content-Type': 'application/octet-stream' } })
        expectStatus(response.status, [201])
      })
      return true
    },
    async download(path: string) {
      const entry = file(path)
      if (entry.size > maxFileBytes) throw new Error('本次下载超过 16 MiB 文件预算。')
      await operation(false, async (current, signal) => {
        const response = await current.request('GET', entry.path, { signal, readBody: true, headers: entry.etag ? { 'If-Match': entry.etag } : {} })
        expectStatus(response.status, [200])
        offerFileExport(new Blob([response.data.slice().buffer as ArrayBuffer]), entry.name)
      })
    },
    async deleteFile(path: string) {
      const entry = file(path)
      if (!entry.etag || !/^"[^"\r\n]+"$/.test(entry.etag)) throw new Error('服务器未提供强 ETag；为避免删除变化后的文件，本次不允许删除。')
      await operation(true, async (current, signal) => {
        const response = await current.request('DELETE', entry.path, { signal, headers: { 'If-Match': entry.etag! } })
        expectStatus(response.status, [200, 204])
      })
    },
    cancel() { controller?.abort() },
    disconnect() { generation++; controller?.abort(); client = undefined; listing = undefined; knownDirectories.clear(); knownDirectories.add('') },
  })
}
