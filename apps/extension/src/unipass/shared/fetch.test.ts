import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchWithTimeout } from './fetch'
import { WebDavBackend } from '../background/vault/webdav-backend'

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

/** Like native fetch, headers arrive first; aborting the request errors its body. */
function pendingBody(status = 200) {
  let signal: AbortSignal | undefined
  vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init: RequestInit) => {
    signal = init.signal!
    const body = new ReadableStream<Uint8Array>({ start(controller) {
      signal!.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')), { once: true })
    } })
    return new Response(body, { status, headers: { ETag: '"test-revision"' } })
  }))
  return () => signal!
}

describe('response-body deadlines', () => {
  it('aborts when headers arrive but the response body stalls', async () => {
    vi.useFakeTimers()
    const signal = pendingBody()
    const result = fetchWithTimeout('https://test.example/', {}, response => response.text(), 40)
    const assertion = expect(result).rejects.toThrow('网络请求超时')
    await vi.advanceTimersByTimeAsync(40)
    await assertion
    expect(signal().aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('returns consumed data and clears its deadline', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('complete')))
    await expect(fetchWithTimeout('https://test.example/', {}, response => response.text(), 40)).resolves.toBe('complete')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('honors caller cancellation while reading the body', async () => {
    const signal = pendingBody()
    const controller = new AbortController()
    const result = fetchWithTimeout('https://test.example/', { signal: controller.signal }, response => response.text())
    const assertion = expect(result).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    await assertion
    expect(signal().aborted).toBe(true)
  })

  it('releases an unread response and clears the timer if the consumer fails', async () => {
    vi.useFakeTimers()
    const signal = pendingBody()
    await expect(fetchWithTimeout('https://test.example/', {}, async () => { throw new Error('bad response') })).rejects.toThrow('网络请求失败')
    expect(signal().aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['get', 'list'] as const)('enforces the deadline in WebDAV %s body consumption', async (method) => {
    vi.useFakeTimers()
    const signal = pendingBody(method === 'list' ? 207 : 200)
    const backend = new WebDavBackend('https://test.example/', 'test-user', 'test-only')
    const result = method === 'get' ? backend.get('manifest') : backend.list()
    const assertion = expect(result).rejects.toThrow('网络请求超时')
    await vi.advanceTimersByTimeAsync(12_000)
    await assertion
    expect(signal().aborted).toBe(true)
  })

  it('keeps HTTP errors readable and aborts their unused bodies', async () => {
    const signal = pendingBody(401)
    const backend = new WebDavBackend('https://test.example/', 'test-user', 'test-only')
    await expect(backend.get('manifest')).rejects.toThrow('WebDAV 认证失败')
    expect(signal().aborted).toBe(true)
  })

  it('preserves WebDAV bytes and ETag after successful consumption', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { ETag: '"v1"' } })))
    const backend = new WebDavBackend('https://test.example/', 'test-user', 'test-only')
    await expect(backend.get('manifest')).resolves.toEqual({ id: 'manifest', data: new Uint8Array([1, 2, 3]), revision: '"v1"' })
  })
})
