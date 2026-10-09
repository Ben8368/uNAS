import { describe, expect, it, vi } from 'vitest'
import type { FileRef } from '#contracts'
import { createPreviewReader, readPreviewFile } from './previewRead'

const ref: FileRef = { schemaVersion: 1, id: 'test', name: 'image.bin', size: 3 * 1024 * 1024, source: 'webdav', authorization: 'available' }
const signal = () => new AbortController().signal

describe('preview content budgets', () => {
  it('opens a 3 MiB raster image without a declared MIME type after a 16-byte signature read', async () => {
    const bytes = new Uint8Array(ref.size)
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const read = vi.fn(async (_ref, options) => options.length === undefined ? bytes : bytes.slice(0, options.length))
    expect(await readPreviewFile(ref, { read }, signal())).toBe(bytes)
    expect(read.mock.calls.map(([, options]) => [options.maxBytes, options.length])).toEqual([[16, 16], [8 * 1024 * 1024, undefined]])
  })

  it('rejects oversized text even when the caller claims it is an image', async () => {
    const read = vi.fn(async () => new TextEncoder().encode('plain text'))
    await expect(readPreviewFile({ ...ref, declaredType: 'image/png' }, { read }, signal())).rejects.toThrow('上限')
    expect(read).toHaveBeenCalledOnce()
  })

  it('rejects files beyond the image budget before reading and honors cancellation after sniffing', async () => {
    const read = vi.fn(async () => new Uint8Array())
    await expect(readPreviewFile({ ...ref, size: 8 * 1024 * 1024 + 1 }, { read }, signal())).rejects.toThrow('上限')
    expect(read).not.toHaveBeenCalled()
    const controller = new AbortController()
    read.mockImplementation(async () => { controller.abort(); return new Uint8Array() })
    await expect(readPreviewFile(ref, { read }, controller.signal)).rejects.toThrow()
    expect(read).toHaveBeenCalledOnce()
  })

  it('reads only the requested prefix and releases an incomplete read lease', async () => {
    const cancel = vi.fn(async () => {})
    const open = vi.fn(async () => ({ stream: new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array([1])); controller.close() } }), offset: 0, length: 16, cancel }))
    const reader = createPreviewReader('webdav', async () => ({ ref }), open)
    await expect(reader.read(ref, { maxBytes: 16, length: 16, signal: signal() })).rejects.toThrow('不完整')
    expect(open).toHaveBeenCalledWith(ref, expect.objectContaining({ offset: 0, length: 16 }))
    expect(cancel).toHaveBeenCalledOnce()
  })
})
