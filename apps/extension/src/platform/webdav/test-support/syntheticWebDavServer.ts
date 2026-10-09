import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'

export const SYNTHETIC_WEBDAV_USERNAME = 'fixture-user'
export const SYNTHETIC_WEBDAV_PASSWORD = 'fixture-password-only'

export interface SyntheticWebDavOptions {
  content?: Uint8Array
  ignoreRange?: boolean
  rejectRanges?: boolean
  /** Return 206 once, then change ETag to model a replacement during playback. */
  changeEtagAfterFirstRange?: boolean
  slowMs?: number
  slowAfterRequests?: number
  dropAfterBytes?: number
  revokeAfterRequests?: number
}

export interface SyntheticWebDavRequest {
  method: string
  path: string
  range?: string
  ifRange?: string
  ifMatch?: string
  authorized: boolean
}

/**
 * Credential-free, in-memory WebDAV-shaped test server. It binds only to
 * 127.0.0.1 and accepts one documented synthetic Basic Auth pair.
 */
export class SyntheticWebDavServer {
  readonly requests: SyntheticWebDavRequest[] = []
  readonly content: Uint8Array
  private readonly server: Server
  private address?: AddressInfo
  private requestCount = 0
  private rangeCount = 0
  private etagVersion = 1

  constructor(readonly options: SyntheticWebDavOptions = {}) {
    this.content = options.content?.slice() ?? new TextEncoder().encode('synthetic-webdav-content')
    this.server = createServer((request, response) => { void this.handle(request, response) })
  }

  async start(): Promise<this> {
    if (this.address) return this
    await new Promise<void>((resolve, reject) => {
      this.server.once('error', reject)
      this.server.listen(0, '127.0.0.1', () => { this.server.off('error', reject); resolve() })
    })
    this.address = this.server.address() as AddressInfo
    return this
  }

  /** HTTPS-shaped endpoint accepted by production URL validation. Tests map it to this loopback-only HTTP listener. */
  get endpoint(): string {
    if (!this.address) throw new Error('Synthetic WebDAV server is not started')
    return `https://127.0.0.1:${this.address.port}/dav/`
  }

  /** URL bridge for a test-only fetch wrapper; never forwards outside loopback. */
  get bridgeOrigin(): string {
    if (!this.address) throw new Error('Synthetic WebDAV server is not started')
    return `http://127.0.0.1:${this.address.port}`
  }

  async close(): Promise<void> {
    if (!this.address) return
    await new Promise<void>((resolve, reject) => this.server.close(error => error ? reject(error) : resolve()))
    this.address = undefined
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const authorization = request.headers.authorization
    const expected = `Basic ${Buffer.from(`${SYNTHETIC_WEBDAV_USERNAME}:${SYNTHETIC_WEBDAV_PASSWORD}`).toString('base64')}`
    const authorized = authorization === expected
    const path = request.url ?? '/'
    const entry: SyntheticWebDavRequest = {
      method: request.method ?? 'GET', path, range: request.headers.range,
      ifRange: headerValue(request.headers['if-range']), ifMatch: headerValue(request.headers['if-match']), authorized,
    }
    this.requests.push(entry)
    this.requestCount++

    if (!authorized) { response.writeHead(401, { 'WWW-Authenticate': 'Basic realm="synthetic"' }).end(); return }
    if (this.options.revokeAfterRequests !== undefined && this.requestCount > this.options.revokeAfterRequests) {
      response.writeHead(403).end(); return
    }
    if (!path.startsWith('/dav/')) { response.writeHead(404).end(); return }

    if (request.method === 'PROPFIND') {
      const body = `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"><d:response><d:href>${escapeXml(path)}</d:href><d:propstat><d:prop><d:getcontentlength>${this.content.byteLength}</d:getcontentlength><d:getetag>${this.etag}</d:getetag><d:getcontenttype>application/octet-stream</d:getcontenttype><d:resourcetype/></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>`
      response.writeHead(207, { 'Content-Type': 'application/xml; charset=utf-8', 'Content-Length': Buffer.byteLength(body) }).end(body)
      return
    }
    if (request.method === 'GET') { await this.get(request, response); return }
    if (request.method === 'PUT') { await this.put(request, response); return }
    if (request.method === 'MKCOL') { response.writeHead(201).end(); return }
    if (request.method === 'DELETE') { response.writeHead(204).end(); return }
    response.writeHead(405).end()
  }

  private async get(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const etag = this.etag
    const range = request.headers.range
    if (range && this.options.rejectRanges) { response.writeHead(416, { 'Content-Range': `bytes */${this.content.byteLength}` }).end(); return }
    if (range && !this.options.ignoreRange) {
      const match = /^bytes=(\d+)-(\d+)$/.exec(range)
      if (!match) { response.writeHead(416, { 'Content-Range': `bytes */${this.content.byteLength}` }).end(); return }
      const start = Number(match[1]), requestedEnd = Number(match[2])
      if (start >= this.content.byteLength || requestedEnd < start) {
        response.writeHead(416, { 'Content-Range': `bytes */${this.content.byteLength}` }).end(); return
      }
      if (request.headers['if-range'] && request.headers['if-range'] !== etag) {
        response.writeHead(200, { 'Content-Length': this.content.byteLength, ETag: etag }).end(this.content)
        return
      }
      const end = Math.min(requestedEnd, this.content.byteLength - 1)
      const body = this.content.slice(start, end + 1)
      this.rangeCount++
      response.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${this.content.byteLength}`,
        'Content-Length': body.byteLength,
        'Accept-Ranges': 'bytes', ETag: etag, 'Content-Type': 'application/octet-stream',
      })
      if (this.options.slowMs && this.requestCount > (this.options.slowAfterRequests ?? 0)) await delay(this.options.slowMs)
      if (this.options.dropAfterBytes !== undefined && this.options.dropAfterBytes < body.byteLength) {
        response.write(body.subarray(0, Math.max(0, this.options.dropAfterBytes)))
        response.destroy()
      } else response.end(body)
      if (this.options.changeEtagAfterFirstRange && this.rangeCount === 1) this.etagVersion++
      return
    }
    response.writeHead(200, {
      'Content-Length': this.content.byteLength,
      'Accept-Ranges': this.options.ignoreRange ? 'none' : 'bytes', ETag: etag,
      'Content-Type': 'application/octet-stream',
    }).end(this.content)
  }

  private async put(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const chunks: Buffer[] = []
    for await (const chunk of request) chunks.push(Buffer.from(chunk))
    if (request.headers['if-match'] && request.headers['if-match'] !== this.etag) {
      response.writeHead(412).end(); return
    }
    if (request.headers['if-none-match'] === '*') { response.writeHead(412).end(); return }
    const body = Buffer.concat(chunks)
    this.content.set(body.subarray(0, Math.min(body.byteLength, this.content.byteLength)))
    this.etagVersion++
    response.writeHead(204, { ETag: this.etag }).end()
  }

  private get etag(): string { return `"fixture-v${this.etagVersion}"` }
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')
}

function delay(ms: number): Promise<void> { return new Promise(resolve => setTimeout(resolve, ms)) }
