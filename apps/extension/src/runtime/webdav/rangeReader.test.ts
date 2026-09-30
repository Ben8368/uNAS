import { describe, expect, it, vi } from 'vitest'
import { WebDavClient, WebDavError, type WebDavResponse } from './client'
import { WebDavRangeError, WebDavRangeReader } from './rangeReader'

const bytes = new TextEncoder().encode('abcdefghij')

function clientFor(handler: (range: string, options: { maxResponseBytes?: number; headers?: Record<string, string>; signal?: AbortSignal }) => WebDavResponse | Promise<WebDavResponse>) {
  const request = vi.fn(async (_method: string, _path: string, options: { headers?: Record<string, string>; maxResponseBytes?: number; signal?: AbortSignal }) => {
    return handler(options.headers?.Range ?? '', options)
  })
  return { client: { request } as unknown as WebDavClient, request }
}

function response(status: number, body: Uint8Array, headers: Record<string, string>): WebDavResponse {
  return { status, ok: status >= 200 && status < 300, headers: new Headers(headers), data: body }
}

function rangeServer(opts: { ignoreRange?: boolean; etag?: string; changedTotal?: number } = {}) {
  return clientFor((range, request) => {
    const match = /^bytes=(\d+)-(\d+)$/.exec(range)
    if (!match) throw new Error('Range required')
    const start = Number(match[1]), end = Number(match[2])
    if (opts.ignoreRange) {
      // Simulates a response that would be large in production. Assert the client
      // was given only the requested byte budget before any body is consumed.
      expect(request.maxResponseBytes).toBeLessThanOrEqual(end - start + 1)
      return response(200, bytes.slice(0, end - start + 1), { 'Content-Length': '999999999' })
    }
    const payload = bytes.slice(start, end + 1)
    const total = opts.changedTotal ?? bytes.byteLength
    return response(206, payload, {
      'Content-Range': `bytes ${start}-${start + payload.byteLength - 1}/${total}`,
      'Content-Length': String(payload.byteLength),
      'Accept-Ranges': 'bytes',
      ETag: opts.etag ?? '"v1"',
    })
  })
}

describe('WebDavRangeReader', () => {
  it('opens from a 206 probe, uses If-Range and reads exact bounded ranges', async () => {
    const { client, request } = rangeServer()
    const reader = await WebDavRangeReader.open(client, 'media.mp3', { maxSegmentBytes: 4 })
    expect(reader.metadata).toMatchObject({ size: 10, etag: '"v1"', acceptsRanges: true })
    const value = await reader.read(3, 4)
    expect(new TextDecoder().decode(value)).toBe('defg')
    expect(request.mock.calls[1]?.[2]?.headers).toMatchObject({ Range: 'bytes=3-6', 'If-Range': '"v1"' })
    expect(request.mock.calls[1]?.[2]?.maxResponseBytes).toBe(4)
  })

  it('streams sequentially with one segment of bounded read-ahead', async () => {
    const { client, request } = rangeServer()
    const reader = await WebDavRangeReader.open(client, 'media.mp3', { maxSegmentBytes: 3 })
    const stream = reader.stream({ start: 2, end: 7 })
    const output = await new Response(stream).text()
    expect(output).toBe('cdefgh')
    expect(request.mock.calls.slice(1).map(call => call[2]?.headers?.Range)).toEqual(['bytes=2-4', 'bytes=5-7'])
    reader.close()
    await expect(reader.read(0, 1)).rejects.toMatchObject({ code: 'closed' })
  })

  it('rejects an ignored Range response and never allows it an unbounded read budget', async () => {
    const { client, request } = rangeServer({ ignoreRange: true })
    await expect(WebDavRangeReader.open(client, 'large.mp4')).rejects.toMatchObject({ code: 'range-not-supported' })
    expect(request.mock.calls[0]?.[2]?.maxResponseBytes).toBe(1)
  })

  it('reports 416 and changed resource versions explicitly', async () => {
    const unsatisfied = clientFor(() => response(416, new Uint8Array(), { 'Content-Range': 'bytes */10' }))
    await expect(WebDavRangeReader.open(unsatisfied.client, 'x')).rejects.toMatchObject({ code: 'range-unsatisfied' })

    let requests = 0
    const { client } = clientFor((range) => {
      const match = /^bytes=(\d+)-(\d+)$/.exec(range)!
      const start = Number(match[1]), end = Number(match[2])
      const payload = bytes.slice(start, end + 1)
      const total = requests++ === 0 ? 10 : 11
      return response(206, payload, { 'Content-Range': `bytes ${start}-${end}/${total}`, 'Content-Length': String(payload.byteLength), ETag: '"v1"' })
    })
    const reader = await WebDavRangeReader.open(client, 'x')
    await expect(reader.read(2, 3)).rejects.toMatchObject({ code: 'resource-changed' })
  })

  it('classifies per-request timeout and caller cancellation', async () => {
    let calls = 0
    const waiting = clientFor((range, request) => {
      if (calls++ === 0) return response(206, bytes.slice(0, 1), { 'Content-Range': 'bytes 0-0/10', 'Content-Length': '1' })
      return new Promise<WebDavResponse>((_resolve, reject) => {
        request.signal?.addEventListener('abort', () => reject(new WebDavError('cancelled', 'native detail')), { once: true })
      })
    })
    const reader = await WebDavRangeReader.open(waiting.client, 'x', { requestTimeoutMs: 5 })
    await expect(reader.read(1, 1)).rejects.toMatchObject({ code: 'timeout' })

    const abort = new AbortController()
    const cancelled = reader.read(1, 1, abort.signal)
    abort.abort()
    await expect(cancelled).rejects.toMatchObject({ code: 'cancelled' })
  })

  it('rejects malformed Content-Range, range mismatch, and body/Content-Length mismatch', async () => {
    const malformed = clientFor(() => response(206, Uint8Array.of(0), { 'Content-Range': 'bytes 0-0/*', 'Content-Length': '1' }))
    await expect(WebDavRangeReader.open(malformed.client, 'x')).rejects.toMatchObject({ code: 'invalid-range-response' })

    const mismatch = clientFor((range) => {
      if (range === 'bytes=0-0') return response(206, Uint8Array.of(0), { 'Content-Range': 'bytes 0-0/10', 'Content-Length': '1', ETag: '"v1"' })
      return response(206, Uint8Array.of(1), { 'Content-Range': 'bytes 2-3/10', 'Content-Length': '2', ETag: '"v1"' })
    })
    const reader = await WebDavRangeReader.open(mismatch.client, 'x')
    await expect(reader.read(2, 2)).rejects.toMatchObject({ code: 'invalid-range-response' })
  })

  it('maps client budget exhaustion without exposing credentials or native diagnostics', async () => {
    const request = vi.fn().mockRejectedValue(new WebDavError('resource-limit', 'internal detail'))
    const client = { request } as unknown as WebDavClient
    await expect(WebDavRangeReader.open(client, 'x')).rejects.toBeInstanceOf(WebDavRangeError)
    await expect(WebDavRangeReader.open(client, 'x')).rejects.toMatchObject({ code: 'range-not-supported' })
  })
})
