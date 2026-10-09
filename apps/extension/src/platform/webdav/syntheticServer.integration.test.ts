import { afterEach, describe, expect, it, vi } from 'vitest'
import { WebDavClient } from './client'
import { WebDavRangeReader } from './rangeReader'
import {
  SYNTHETIC_WEBDAV_PASSWORD,
  SYNTHETIC_WEBDAV_USERNAME,
  SyntheticWebDavServer,
  type SyntheticWebDavOptions,
} from './test-support/syntheticWebDavServer'

const nativeFetch = globalThis.fetch
let server: SyntheticWebDavServer | undefined

afterEach(async () => {
  vi.unstubAllGlobals()
  await server?.close()
  server = undefined
})

async function connect(options: SyntheticWebDavOptions = {}, credentials = {
  username: SYNTHETIC_WEBDAV_USERNAME,
  password: SYNTHETIC_WEBDAV_PASSWORD,
}) {
  server = await new SyntheticWebDavServer({ content: new TextEncoder().encode('0123456789abcdefghijklmnopqrstuvwxyz'), ...options }).start()
  const bridgeOrigin = server.bridgeOrigin
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    // A deliberately narrow bridge: only WebDavClient's loopback fixture host is rewritten.
    if (url.hostname !== '127.0.0.1' || url.protocol !== 'https:' || url.port !== new URL(bridgeOrigin).port) {
      throw new Error('Synthetic WebDAV fetch bridge rejected a non-fixture URL')
    }
    url.protocol = 'http:'
    return nativeFetch(url, init)
  })
  return { server, client: new WebDavClient(server.endpoint, credentials.username, credentials.password, { maxBytes: 1024, timeoutMs: 1500 }) }
}

describe('synthetic WebDAV server over real loopback HTTP', () => {
  it('authenticates PROPFIND and returns a real multistatus response', async () => {
    const { server: fixture, client } = await connect()
    const response = await client.request('PROPFIND', '', { headers: { Depth: '1' }, readBody: true })
    expect(response.status).toBe(207)
    expect(new TextDecoder().decode(response.data)).toContain('<d:getcontentlength>36</d:getcontentlength>')
    expect(fixture.requests[0]).toMatchObject({ method: 'PROPFIND', path: '/dav/', authorized: true })
  })

  it('serves authenticated 206 ranges and supports exact seek reads', async () => {
    const { server: fixture, client } = await connect()
    const reader = await WebDavRangeReader.open(client, 'media.bin', { maxSegmentBytes: 8 })
    const bytes = await reader.read(9, 5)
    expect(new TextDecoder().decode(bytes)).toBe('9abcd')
    expect(fixture.requests.map(item => item.range)).toEqual(['bytes=0-0', 'bytes=9-13'])
    expect(fixture.requests[1]).toMatchObject({ ifRange: '"fixture-v1"', authorized: true })
    reader.close()
  })

  it('rejects a server that ignores Range without buffering the whole file', async () => {
    const { server: fixture, client } = await connect({ ignoreRange: true, content: new Uint8Array(64 * 1024) })
    await expect(WebDavRangeReader.open(client, 'large.bin')).rejects.toMatchObject({ code: 'range-not-supported' })
    expect(fixture.requests[0]?.range).toBe('bytes=0-0')
  })

  it('exposes HTTP 416 as a range boundary failure', async () => {
    const { client } = await connect({ rejectRanges: true })
    await expect(WebDavRangeReader.open(client, 'media.bin')).rejects.toMatchObject({ code: 'range-unsatisfied' })
  })

  it('uses If-Range semantics when the resource ETag changes', async () => {
    const { client } = await connect({ changeEtagAfterFirstRange: true })
    const first = await client.request('GET', 'media.bin', { headers: { Range: 'bytes=0-0' }, readBody: true, maxResponseBytes: 1 })
    expect(first.status).toBe(206)
    const changed = await client.request('GET', 'media.bin', {
      headers: { Range: 'bytes=1-2', 'If-Range': first.headers.get('ETag')! },
      readBody: true,
      maxResponseBytes: 64,
    })
    expect(changed.status).toBe(200)
    expect(changed.headers.get('ETag')).toBe('"fixture-v2"')
    expect(changed.data).toHaveLength(36)
  })

  it('rejects bad credentials and models authorization revocation', async () => {
    const bad = await connect({}, { username: SYNTHETIC_WEBDAV_USERNAME, password: 'wrong-synthetic-password' })
    await expect(bad.client.request('PROPFIND')).rejects.toMatchObject({ code: 'authentication' })
    expect(bad.server.requests[0]?.authorized).toBe(false)
    await bad.server.close()
    server = undefined

    const revoked = await connect({ revokeAfterRequests: 1 })
    const reader = await WebDavRangeReader.open(revoked.client, 'media.bin')
    await expect(reader.read(1, 3)).rejects.toMatchObject({ code: 'permission' })
  })

  it('does not apply a stale If-Match write after a remote version conflict', async () => {
    const { server: fixture, client } = await connect()
    const response = await client.request('PUT', 'note.md', {
      body: new TextEncoder().encode('replacement'),
      headers: { 'If-Match': '"another-client-version"' },
    })
    expect(response.status).toBe(412)
    expect(fixture.requests[0]).toMatchObject({ method: 'PUT', ifMatch: '"another-client-version"', authorized: true })
  })

  it('reports a dropped response as a network failure without native diagnostics', async () => {
    const { client } = await connect({ dropAfterBytes: 2 })
    await expect(client.request('GET', 'media.bin', { headers: { Range: 'bytes=0-7' }, readBody: true }))
      .rejects.toMatchObject({ code: 'network', message: '网络请求失败，请稍后重试' })
  })

  it('cancels a slow range request within the configured reader deadline', async () => {
    const { client } = await connect({ slowMs: 200, slowAfterRequests: 1 })
    const reader = await WebDavRangeReader.open(client, 'media.bin', { requestTimeoutMs: 20 })
    await expect(reader.read(1, 4)).rejects.toMatchObject({ code: 'timeout' })
  })
})
