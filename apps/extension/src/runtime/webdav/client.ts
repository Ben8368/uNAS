import { normalizeWebDavUrl } from '../../shared/webdav-url'

export type WebDavMethod = 'GET' | 'PUT' | 'DELETE' | 'PROPFIND' | 'MKCOL'
export interface WebDavRequest {
  headers?: Record<string, string>
  body?: Uint8Array
  signal?: AbortSignal
  readBody?: boolean
}
export interface WebDavResponse { status: number; ok: boolean; headers: Headers; data: Uint8Array }
export type WebDavErrorCode = 'invalid-path' | 'resource-limit' | 'timeout' | 'cancelled' | 'network' | 'authentication' | 'permission'
export class WebDavError extends Error {
  constructor(readonly code: WebDavErrorCode, message: string) { super(message); this.name = 'WebDavError' }
}

/** Bounded transport only: no Vault schema, secrets store, permission prompts, or UI dependencies. */
export class WebDavClient {
  readonly endpoint: string
  private readonly authorization: string
  private readonly maxBytes: number
  private readonly timeoutMs: number

  constructor(endpoint: string, username: string, appPassword: string, options: { maxBytes?: number; timeoutMs?: number } = {}) {
    this.endpoint = normalizeWebDavUrl(endpoint)
    username = username.trim()
    if (!username || username.includes(':') || !appPassword) throw new Error('WebDAV 用户名或 App Password 无效')
    this.maxBytes = options.maxBytes ?? 16 * 1024 * 1024
    this.timeoutMs = options.timeoutMs ?? 12_000
    if (!Number.isSafeInteger(this.maxBytes) || this.maxBytes < 1 || this.maxBytes > 64 * 1024 * 1024
      || !Number.isSafeInteger(this.timeoutMs) || this.timeoutMs < 1 || this.timeoutMs > 60_000) throw new Error('WebDAV 请求预算无效')
    const bytes = new TextEncoder().encode(username + ':' + appPassword)
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    this.authorization = 'Basic ' + btoa(binary)
  }

  async request(method: WebDavMethod, path = '', options: WebDavRequest = {}): Promise<WebDavResponse> {
    const url = this.resolvePath(path)
    if (options.body && options.body.byteLength > this.maxBytes) throw new WebDavError('resource-limit', 'WebDAV 请求超过大小限制')
    const controller = new AbortController()
    const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)
    let response: Response | undefined
    try {
      signal.throwIfAborted()
      const headers = new Headers(options.headers)
      headers.set('Authorization', this.authorization)
      headers.set('Accept', 'application/json, application/xml, application/octet-stream')
      response = await fetch(url, {
        method, headers, signal, redirect: 'error', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
        body: options.body ? options.body.slice().buffer as ArrayBuffer : undefined,
      })
      if (response.status === 401) throw new WebDavError('authentication', 'WebDAV 认证失败（HTTP 401），请确认地址和 App Password')
      if (response.status === 403) throw new WebDavError('permission', 'WebDAV 权限不足，请检查目标目录权限')
      const data = response.ok && options.readBody ? await readBounded(response, this.maxBytes) : new Uint8Array()
      return { status: response.status, ok: response.ok, headers: response.headers, data }
    } catch (error) {
      if (options.signal?.aborted) throw new WebDavError('cancelled', 'WebDAV 请求已取消')
      if (controller.signal.aborted) throw new WebDavError('timeout', '网络请求超时，请稍后重试')
      if (error instanceof WebDavError) throw error
      // Do not expose endpoint paths, Authorization, or native fetch diagnostics to UI/logs.
      throw new WebDavError('network', '网络请求失败，请稍后重试')
    } finally {
      clearTimeout(timeout)
      controller.abort()
      if (response?.body && !response.body.locked) await response.body.cancel().catch(() => undefined)
    }
  }

  private resolvePath(path: string): string {
    // Paths are endpoint-relative; reject encoded traversal, alternate origins, query and fragment syntax.
    let decoded: string
    try { decoded = decodeURIComponent(path) } catch { throw new WebDavError('invalid-path', 'WebDAV 相对路径无效') }
    if (decoded.startsWith('/') || /[\\%?#:]/.test(decoded) || [...decoded].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
      || decoded.split('/').some(segment => segment === '.' || segment === '..')
      || decoded.includes('//')) throw new WebDavError('invalid-path', 'WebDAV 相对路径无效')
    return new URL(decoded.split('/').map(encodeURIComponent).join('/'), this.endpoint).toString()
  }
}

async function readBounded(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get('Content-Length'))
  if (Number.isFinite(declared) && declared > maxBytes) throw new WebDavError('resource-limit', 'WebDAV 响应超过大小限制')
  if (!response.body) return new Uint8Array()
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) throw new WebDavError('resource-limit', 'WebDAV 响应超过大小限制')
      chunks.push(value)
    }
    const data = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength }
    return data
  } finally {
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}
