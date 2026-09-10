/// <reference lib="webworker" />

import { BlobReader, BlobWriter, configure, ZipReader } from '@zip.js/zip.js'

import { safeArchivePath, validateArchiveEntries } from 'unas-src/archive/zipSafety'

configure({ useWebWorkers: false })

type ExtractRequest = { type: 'extract'; id: string; file: File }
type AcknowledgeRequest = { type: 'ack'; id: string }
type CancelRequest = { type: 'cancel'; id: string }
type WorkerRequest = ExtractRequest | AcknowledgeRequest | CancelRequest
type PendingAck = { resolve: () => void; reject: () => void }

let active: { id: string; controller: AbortController; pendingAck?: PendingAck } | undefined

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  if (!request || typeof request !== 'object' || typeof request.id !== 'string') return
  if (request.type === 'extract') {
    if (active) {
      self.postMessage({ type: 'error', id: request.id, message: '已有 ZIP 解压正在进行。' })
      return
    }
    void extract(request)
    return
  }
  if (!active || active.id !== request.id) return
  if (request.type === 'ack') {
    active.pendingAck?.resolve()
    active.pendingAck = undefined
  }
  if (request.type === 'cancel') {
    active.controller.abort()
    active.pendingAck?.reject()
    active.pendingAck = undefined
  }
})

async function extract(request: ExtractRequest) {
  const controller = new AbortController()
  active = { id: request.id, controller }
  const reader = new ZipReader(new BlobReader(request.file))
  try {
    const entries = await reader.getEntries({ strictness: 'strict', filenameValidation: 'strict' })
    const planned = validateArchiveEntries(entries.map((entry) => ({
      path: entry.filename,
      directory: entry.directory,
      size: entry.uncompressedSize,
      encrypted: entry.encrypted,
      symlink: entry.symlink,
    })))
    for (let index = 0; index < entries.length; index += 1) {
      if (controller.signal.aborted) throw new DOMException('已取消解压。', 'AbortError')
      const entry = entries[index]
      const plannedEntry = planned[index]
      if (entry.directory) {
        await emitAndWait({ type: 'directory', id: request.id, path: plannedEntry.path })
        continue
      }
      const output = await entry.getData(new BlobWriter(), { checkCrc32: true, signal: controller.signal })
      if (output.size !== plannedEntry.size) throw new Error('ZIP_OUTPUT_SIZE_MISMATCH')
      await emitAndWait({ type: 'file', id: request.id, path: safeArchivePath(plannedEntry.path, false), size: output.size, data: output })
    }
    self.postMessage({ type: 'complete', id: request.id })
  } catch (error) {
    self.postMessage({ type: 'error', id: request.id, message: publicError(error) })
  } finally {
    await reader.close().catch(() => undefined)
    active = undefined
  }
}

function emitAndWait(message: Record<string, unknown>) {
  return new Promise<void>((resolve, reject) => {
    if (!active || active.controller.signal.aborted) { reject(new DOMException('已取消解压。', 'AbortError')); return }
    active.pendingAck = { resolve, reject }
    self.postMessage(message)
  })
}

function publicError(error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') return '已取消解压；未向目录写入任何文件。'
  if (error instanceof Error && error.message.startsWith('ZIP_')) return '压缩包包含不安全、加密或超出当前资源上限的条目。'
  return '无法解压此 ZIP；它可能已损坏、加密或使用了不支持的压缩方式。'
}
