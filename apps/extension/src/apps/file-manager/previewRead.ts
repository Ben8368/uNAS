import type { FileRef, FileReadLease, FileReadOptions } from '#contracts'
import { PREVIEW_READ_LIMITS, rasterType } from './previewRegistry'

export type PreviewReadOptions = { maxBytes: number; length?: number; signal: AbortSignal }
export type PreviewReadService = { read(ref: FileRef, options: PreviewReadOptions): Promise<Uint8Array> }

/** MIME is a hint. Read a bounded signature before selecting the full-content budget. */
export async function readPreviewFile(file: FileRef, reader: PreviewReadService, signal: AbortSignal) {
  if (file.size > PREVIEW_READ_LIMITS.imageBytes) throw new Error('文件超过预览读取上限。')
  const prefix = await reader.read(file, { maxBytes: 16, length: Math.min(file.size, 16), signal })
  signal.throwIfAborted()
  const maxBytes = rasterType(prefix) ? PREVIEW_READ_LIMITS.imageBytes : PREVIEW_READ_LIMITS.textBytes
  if (file.size > maxBytes) throw new Error('文件超过预览读取上限。')
  const bytes = await reader.read(file, { maxBytes, signal })
  signal.throwIfAborted()
  if (bytes.byteLength > maxBytes) throw new Error('文件超过预览读取上限。')
  return bytes
}

export function createPreviewReader(
  source: FileRef['source'],
  metadata: (ref: FileRef) => Promise<{ ref: FileRef }>,
  openRead: (ref: FileRef, options: FileReadOptions) => Promise<FileReadLease>,
): PreviewReadService {
  return { async read(ref, options) {
    if (ref.source !== source) throw new Error('文件来源不属于当前预览会话。')
    await metadata(ref)
    options.signal.throwIfAborted()
    const length = options.length ?? ref.size
    if (!Number.isSafeInteger(length) || length < 0 || length > ref.size || length > options.maxBytes) throw new Error('文件超过预览读取上限。')
    if (length === 0) return new Uint8Array()
    const lease = await openRead(ref, { offset: 0, length, signal: options.signal })
    const reader = lease.stream.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    try {
      for (;;) {
        options.signal.throwIfAborted()
        const next = await reader.read()
        if (next.done) break
        total += next.value.byteLength
        if (total > length) throw new Error('文件超过预览读取上限。')
        chunks.push(next.value)
      }
    } finally { await lease.cancel(); reader.releaseLock() }
    if (total !== length) throw new Error('文件读取不完整，请刷新后重新打开。')
    const bytes = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    return bytes
  } }
}
