import type { FileRef, FileReadLease, FileReadOptions } from '#contracts'

type FileHandle = { getFile(): Promise<File> }
const MAX_FILE_READ_BYTES = 8 * 1024 * 1024

/** Owns ephemeral references and bounded reads, separate from directory grants and writes. */
export function createAuthorizedFileRefs(requireReadableDirectory: () => Promise<void>, grantId: () => string | undefined) {
  const fileHandles = new Map<string, { handle: FileHandle; grantId: string; ref: FileRef; lastModified: number }>()
  async function create(handle: FileHandle, owner: string): Promise<FileRef> {
    await requireReadableDirectory()
    if (owner !== grantId()) throw new Error('文件授权已失效。')
    const file = await handle.getFile()
    if (owner !== grantId()) throw new Error('文件授权已变化，请重新选择。')
    const ref: FileRef = {
      schemaVersion: 1, id: crypto.randomUUID(), name: file.name, size: file.size,
      ...(file.type ? { declaredType: file.type } : {}), source: 'handle', authorization: 'available',
    }
    fileHandles.set(ref.id, { handle, grantId: owner, ref, lastModified: file.lastModified })
    while (fileHandles.size > 256) fileHandles.delete(fileHandles.keys().next().value!)
    return ref
  }

  async function resolveFile(ref: FileRef) {
    await requireReadableDirectory()
    const record = fileHandles.get(ref.id)
    if (!record || !grantId() || record.grantId !== grantId() || JSON.stringify(record.ref) !== JSON.stringify(ref)) throw new Error('文件引用已失效，请从 Files 中重新选择文件。')
    const file = await record.handle.getFile()
    if (record.grantId !== grantId()) throw new Error('文件授权已变化，请重新选择。')
    if (file.name !== ref.name || file.size !== ref.size || file.lastModified !== record.lastModified) throw new Error('文件已变化，请从 Files 中刷新后重新打开。')
    return file
  }

  async function openRead(ref: FileRef, options: FileReadOptions = {}): Promise<FileReadLease> {
    const file = await resolveFile(ref)
    const offset = options.offset ?? 0
    const length = options.length ?? Math.min(file.size - offset, MAX_FILE_READ_BYTES)
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > file.size || !Number.isSafeInteger(length) || length < 0 || length > MAX_FILE_READ_BYTES || offset + length > file.size) throw new Error('文件读取范围超出 8 MiB 单次预算。')
    options.signal?.throwIfAborted()
    const reader = file.slice(offset, offset + length).stream().getReader()
    let closed = false
    const cancel = async (reason?: unknown) => {
      if (closed) return
      closed = true
      options.signal?.removeEventListener('abort', onAbort)
      await reader.cancel(reason).catch(() => undefined)
      try { reader.releaseLock() } catch { /* The browser may already have released it. */ }
    }
    const onAbort = () => { void cancel(options.signal?.reason) }
    options.signal?.addEventListener('abort', onAbort, { once: true })
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          options.signal?.throwIfAborted()
          const next = await reader.read()
          if (next.done) { closed = true; options.signal?.removeEventListener('abort', onAbort); reader.releaseLock(); controller.close() }
          else controller.enqueue(next.value)
        } catch (error) { controller.error(error); await cancel(error) }
      },
      cancel,
    })
    return { stream, offset, length, cancel }
  }

  async function metadata(ref: FileRef) {
    const file = await resolveFile(ref)
    return { ref, capabilities: { canRead: true, canStream: true, canSeek: true, canWrite: false, maxReadBytes: MAX_FILE_READ_BYTES }, modified: new Date(file.lastModified).toISOString() }
  }

  /** Returns a browser File object only inside the current owner page for native media playback. */
  async function mediaFile(ref: FileRef): Promise<File> {
    return resolveFile(ref)
  }
  return { create, openRead, metadata, mediaFile, clear: () => fileHandles.clear() }
}
