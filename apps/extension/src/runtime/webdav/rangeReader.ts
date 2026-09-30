import { WebDavClient, WebDavError } from './client'

export type WebDavRangeErrorCode =
  | 'cancelled'
  | 'timeout'
  | 'network'
  | 'authentication'
  | 'permission'
  | 'range-not-supported'
  | 'range-unsatisfied'
  | 'resource-changed'
  | 'invalid-range-response'
  | 'resource-limit'
  | 'closed'

export class WebDavRangeError extends Error {
  constructor(readonly code: WebDavRangeErrorCode, message: string) {
    super(message)
    this.name = 'WebDavRangeError'
  }
}

export interface WebDavRangeReaderOptions {
  /** Maximum bytes retained for one Range response. Must also fit the client's response budget. */
  maxSegmentBytes?: number
  /** Upper bound for each individual request, independent of the client's overall timeout. */
  requestTimeoutMs?: number
  /** Maximum number of sequential read() calls made by one stream. */
  maxReads?: number
}

export interface WebDavRangeMetadata {
  size: number
  etag?: string
  lastModified?: string
  acceptsRanges: true
  contentType?: string
}

/**
 * Authenticated, bounded byte-range access layered on the existing WebDavClient.
 * The client remains the only owner of Authorization and endpoint policy. Each
 * request is capped before its body is read, including servers that ignore Range.
 */
export class WebDavRangeReader {
  readonly metadata: WebDavRangeMetadata
  private closed = false
  private active = new Set<AbortController>()
  private readonly maxSegmentBytes: number
  private readonly requestTimeoutMs: number
  private readonly maxReads: number

  private constructor(
    private readonly client: WebDavClient,
    private readonly path: string,
    metadata: WebDavRangeMetadata,
    options: Required<WebDavRangeReaderOptions>,
  ) {
    this.metadata = metadata
    this.maxSegmentBytes = options.maxSegmentBytes
    this.requestTimeoutMs = options.requestTimeoutMs
    this.maxReads = options.maxReads
  }

  static async open(
    client: WebDavClient,
    path: string,
    options: WebDavRangeReaderOptions & { signal?: AbortSignal } = {},
  ): Promise<WebDavRangeReader> {
    const normalized = validateOptions(options)
    const response = await boundedRequest(client, path, 'bytes=0-0', 1, options.signal, normalized.requestTimeoutMs)
    if (response.status === 416) throw rangeError('range-unsatisfied')
    if (response.status === 200) throw rangeError('range-not-supported')
    if (response.status !== 206) throw statusError(response.status)

    const parsed = parseContentRange(response.headers.get('Content-Range'))
    if (!parsed || parsed.start !== 0 || parsed.end !== 0 || parsed.total < 1) {
      throw rangeError('invalid-range-response')
    }
    validateBody(response.data, 1, response.headers.get('Content-Length'))
    const acceptsRanges = response.headers.get('Accept-Ranges')?.toLowerCase().split(',').map(v => v.trim()).includes('bytes')
    // A valid 206 is definitive capability evidence even when Accept-Ranges is omitted.
    if (acceptsRanges === false && !response.headers.get('Content-Range')) throw rangeError('range-not-supported')

    return new WebDavRangeReader(client, path, {
      size: parsed.total,
      etag: strongEtag(response.headers.get('ETag')),
      lastModified: response.headers.get('Last-Modified') ?? undefined,
      acceptsRanges: true,
      contentType: response.headers.get('Content-Type') ?? undefined,
    }, normalized)
  }

  /** Read one bounded inclusive byte interval. Returned bytes are an owned copy. */
  async read(start: number, length: number, signal?: AbortSignal): Promise<Uint8Array> {
    this.ensureOpen()
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(length) || start < 0 || length < 1
      || start >= this.metadata.size || length > this.maxSegmentBytes) {
      throw rangeError('resource-limit')
    }
    const end = Math.min(this.metadata.size - 1, start + length - 1)
    const expected = end - start + 1
    const range = `bytes=${start}-${end}`
    const requestController = new AbortController()
    this.active.add(requestController)
    const requestSignal = signal ? AbortSignal.any([signal, requestController.signal]) : requestController.signal
    let response: Awaited<ReturnType<WebDavClient['request']>>
    try {
      response = await boundedRequest(this.client, this.path, range, expected, requestSignal, this.requestTimeoutMs, this.metadata.etag)
    } finally {
      this.active.delete(requestController)
    }
    if (response.status === 416) throw rangeError('range-unsatisfied')
    if (response.status === 200) throw rangeError(this.metadata.etag ? 'resource-changed' : 'range-not-supported')
    if (response.status === 412) throw rangeError('resource-changed')
    if (response.status !== 206) throw statusError(response.status)

    const parsed = parseContentRange(response.headers.get('Content-Range'))
    if (!parsed) throw rangeError('invalid-range-response')
    if (parsed.total !== this.metadata.size || parsed.start !== start || parsed.end !== end) {
      throw rangeError('resource-changed')
    }
    const receivedEtag = strongEtag(response.headers.get('ETag'))
    if (this.metadata.etag && receivedEtag !== this.metadata.etag) throw rangeError('resource-changed')
    validateBody(response.data, expected, response.headers.get('Content-Length'))
    return response.data.slice()
  }

  /** Sequential pull stream; at most one segment is in flight and buffered. */
  stream(options: { start?: number; end?: number; signal?: AbortSignal } = {}): ReadableStream<Uint8Array> {
    this.ensureOpen()
    const start = options.start ?? 0
    const end = options.end ?? this.metadata.size - 1
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end >= this.metadata.size) {
      throw rangeError('resource-limit')
    }
    let cursor = start
    let reads = 0
    let cancelled = false
    return new ReadableStream<Uint8Array>({
      pull: async controller => {
        if (cancelled || cursor > end) { controller.close(); return }
        if (++reads > this.maxReads) {
          controller.error(rangeError('resource-limit'))
          return
        }
        const length = Math.min(this.maxSegmentBytes, end - cursor + 1)
        try {
          const chunk = await this.read(cursor, length, options.signal)
          cursor += chunk.byteLength
          controller.enqueue(chunk)
          if (cursor > end) controller.close()
        } catch (error) {
          controller.error(error)
        }
      },
      cancel: () => {
        cancelled = true
        for (const controller of this.active) controller.abort()
      },
    }, { highWaterMark: 1, size: chunk => chunk.byteLength })
  }

  /** Abort requests made through this reader. Subsequent reads are rejected. */
  close(): void {
    if (this.closed) return
    this.closed = true
    for (const controller of this.active) controller.abort()
    this.active.clear()
  }

  private ensureOpen(): void {
    if (this.closed) throw rangeError('closed')
  }
}

async function boundedRequest(
  client: WebDavClient,
  path: string,
  range: string,
  expectedBytes: number,
  callerSignal: AbortSignal | undefined,
  timeoutMs: number,
  etag?: string,
) {
  const controller = new AbortController()
  const signal = callerSignal ? AbortSignal.any([callerSignal, controller.signal]) : controller.signal
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    signal.throwIfAborted()
    const headers: Record<string, string> = { Range: range }
    if (etag) headers['If-Range'] = etag
    const result = await client.request('GET', path, {
      headers,
      signal,
      readBody: true,
      // A 200 response from a Range-ignoring server can never cause an unbounded read.
      maxResponseBytes: Math.max(1, expectedBytes),
    })
    return result
  } catch (error) {
    if (controller.signal.aborted) throw rangeError('timeout')
    if (callerSignal?.aborted) throw rangeError('cancelled')
    if (error instanceof WebDavError) {
      if (error.code === 'cancelled') throw rangeError('cancelled')
      if (error.code === 'timeout') throw rangeError('timeout')
      if (error.code === 'authentication') throw rangeError('authentication')
      if (error.code === 'permission') throw rangeError('permission')
      if (error.code === 'resource-limit') throw rangeError('range-not-supported')
      throw rangeError('network')
    }
    throw rangeError('network')
  } finally {
    clearTimeout(timeout)
    controller.abort()
  }
}

function parseContentRange(value: string | null): { start: number; end: number; total: number } | undefined {
  if (!value) return undefined
  const match = /^bytes (\d+)-(\d+)\/(\d+)$/i.exec(value.trim())
  if (!match) return undefined
  const start = Number(match[1]), end = Number(match[2]), total = Number(match[3])
  if (![start, end, total].every(Number.isSafeInteger) || start < 0 || end < start || total <= end) return undefined
  return { start, end, total }
}

function validateBody(data: Uint8Array, expected: number, contentLength: string | null): void {
  if (contentLength !== null && (!/^\d+$/.test(contentLength) || Number(contentLength) !== expected)) {
    throw rangeError('invalid-range-response')
  }
  if (data.byteLength !== expected) throw rangeError('invalid-range-response')
}

function strongEtag(value: string | null): string | undefined {
  if (!value || value.startsWith('W/')) return undefined
  return value
}

function statusError(status: number): WebDavRangeError {
  if (status === 401) return rangeError('authentication')
  if (status === 403) return rangeError('permission')
  if (status === 416) return rangeError('range-unsatisfied')
  return rangeError('network')
}

function rangeError(code: WebDavRangeErrorCode): WebDavRangeError {
  const messages: Record<WebDavRangeErrorCode, string> = {
    cancelled: 'WebDAV 分段读取已取消',
    timeout: 'WebDAV 分段读取超时',
    network: 'WebDAV 分段读取失败',
    authentication: 'WebDAV 认证失败',
    permission: 'WebDAV 文件访问权限不足',
    'range-not-supported': '服务器未提供安全的 HTTP Range 读取',
    'range-unsatisfied': '服务器拒绝该字节范围（HTTP 416）',
    'resource-changed': '远程文件在读取期间发生变化',
    'invalid-range-response': '服务器返回的分段响应无效',
    'resource-limit': '分段读取超出大小或次数限制',
    closed: 'WebDAV 分段读取器已关闭',
  }
  return new WebDavRangeError(code, messages[code])
}

function validateOptions(options: WebDavRangeReaderOptions): Required<WebDavRangeReaderOptions> {
  const normalized = {
    maxSegmentBytes: options.maxSegmentBytes ?? 512 * 1024,
    requestTimeoutMs: options.requestTimeoutMs ?? 12_000,
    maxReads: options.maxReads ?? 1_000_000,
  }
  if (!Number.isSafeInteger(normalized.maxSegmentBytes) || normalized.maxSegmentBytes < 1 || normalized.maxSegmentBytes > 8 * 1024 * 1024
    || !Number.isSafeInteger(normalized.requestTimeoutMs) || normalized.requestTimeoutMs < 1 || normalized.requestTimeoutMs > 60_000
    || !Number.isSafeInteger(normalized.maxReads) || normalized.maxReads < 1 || normalized.maxReads > 1_000_000) {
    throw rangeError('resource-limit')
  }
  return normalized
}
