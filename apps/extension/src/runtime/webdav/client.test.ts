import { afterEach, describe, expect, it, vi } from 'vitest'
import { WebDavClient } from './client'
import { normalizeWebDavUrl } from '../../shared/webdav-url'

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })
const create = (maxBytes = 1024) => new WebDavClient('https://dav.example/base/', '用户', 'test-only', { maxBytes })

describe('shared WebDAV transport', () => {
  it('keeps payload, ETag, conditional headers and credentials scoped to the endpoint', async () => {
    const fetcher = vi.fn(async () => new Response(new Uint8Array([1, 2]), { headers: { ETag: '"v2"' } }))
    vi.stubGlobal('fetch', fetcher)
    const result = await create().request('PUT', 'app/item.json', { body: new Uint8Array([3]), headers: { 'If-Match': '"v1"' }, readBody: true })
    expect(result.data).toEqual(new Uint8Array([1, 2]))
    expect(result.headers.get('ETag')).toBe('"v2"')
    const [url, init] = (fetcher.mock.calls as unknown as Array<[string, RequestInit]>)[0]
    expect(url).toBe('https://dav.example/base/app/item.json')
    expect(init).toMatchObject({ method: 'PUT', redirect: 'error', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' })
    expect(new Headers(init.headers).get('If-Match')).toBe('"v1"')
    expect(new Headers(init.headers).get('Authorization')).toBe('Basic ' + Buffer.from('用户:test-only').toString('base64'))
  })

  it.each(['https://evil.example/x', '//evil.example', '/outside', '../x', '%2e%2e/x', '%252e%252e/x', 'x?query', 'x#hash', 'x%2fy/../z', 'bad%'])('rejects unsafe relative path %s before networking', async path => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    await expect(create().request('GET', path)).rejects.toMatchObject({ code: 'invalid-path' })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it.each(['http://dav.example/', 'https://u:p@dav.example/', 'https://dav.example/?q=1', 'https://dav.example/#x'])('rejects unsafe endpoint %s', endpoint => {
    expect(() => normalizeWebDavUrl(endpoint)).toThrow()
  })

  it('rejects oversized uploads before copying or sending', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    await expect(create(2).request('PUT', 'x', { body: new Uint8Array(3) })).rejects.toMatchObject({ code: 'resource-limit' })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it.each([true, false])('bounds declared and chunked response bodies (declared=%s)', async declared => {
    const cancel = vi.fn()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(3)) }, cancel }), { headers: declared ? { 'Content-Length': '3' } : {} })))
    await expect(create(2).request('GET', 'x', { readBody: true })).rejects.toMatchObject({ code: 'resource-limit' })
    expect(cancel).toHaveBeenCalled()
  })

  it('releases unread bodies and does not leak native diagnostics', async () => {
    const cancel = vi.fn()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({ cancel }), { status: 401 })))
    await expect(create().request('GET', 'x')).rejects.toMatchObject({ code: 'authentication' })
    expect(cancel).toHaveBeenCalled()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('secret URL or password') }))
    await expect(create().request('GET', 'x')).rejects.toMatchObject({ code: 'network', message: '网络请求失败，请稍后重试' })
  })

  it('honors cancellation and releases pending response-body reads', async () => {
    const controller = new AbortController()
    vi.stubGlobal('fetch', vi.fn(async (_url, init: RequestInit) => new Response(new ReadableStream({ start(c) {
      init.signal!.addEventListener('abort', () => c.error(new Error('aborted')), { once: true })
    } }))))
    const result = create().request('GET', 'x', { signal: controller.signal, readBody: true })
    const assertion = expect(result).rejects.toMatchObject({ code: 'cancelled' })
    controller.abort()
    await assertion
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    await expect(create().request('GET', 'x', { signal: controller.signal })).rejects.toMatchObject({ code: 'cancelled' })
    expect(fetcher).not.toHaveBeenCalled()
  })
})
