import { ZIP_EXTRACTION_LIMITS, safeArchivePath } from 'unas-src/archive/zipSafety'
import { extensionApi } from 'unas-src/runtime/extensionPlatform'

export type PreparedArchiveEntry =
  | { type: 'directory'; path: string }
  | { type: 'file'; path: string; size: number; data: Blob }

export type ZipExtractionRun = { result: Promise<PreparedArchiveEntry[]>; cancel: () => void }

type WorkerMessage =
  | { type: 'directory'; id: string; path: string }
  | { type: 'file'; id: string; path: string; size: number; data: Blob }
  | { type: 'complete'; id: string }
  | { type: 'error'; id: string; message: string }

/** Runs ZIP parsing in a dedicated Worker and keeps outputs staged in bounded Blobs until commit. */
export function prepareZipExtraction(file: File): ZipExtractionRun {
  const id = crypto.randomUUID()
  const workerUrl = extensionApi()?.runtime?.getURL('/archive-worker.js') ?? new URL('../../workers/archiveExtraction.worker.ts', import.meta.url)
  const worker = new Worker(workerUrl, { type: 'module', name: 'unas-archive-extract' })
  const prepared: PreparedArchiveEntry[] = []
  let outputBytes = 0
  let settled = false
  let rejectResult: (reason: Error) => void = () => undefined
  const finish = () => { worker.terminate() }
  const fail = (message: string) => {
    if (settled) return
    settled = true
    finish()
    rejectResult(new Error(message))
  }
  const result = new Promise<PreparedArchiveEntry[]>((resolve, reject) => {
    rejectResult = reject
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data
      if (!message || message.id !== id || settled) return
      try {
        if (message.type === 'directory') {
          prepared.push({ type: 'directory', path: safeArchivePath(message.path, true) })
          worker.postMessage({ type: 'ack', id })
          return
        }
        if (message.type === 'file') {
          const path = safeArchivePath(message.path, false)
          if (!(message.data instanceof Blob) || !Number.isSafeInteger(message.size) || message.size < 0 || message.data.size !== message.size || message.size > ZIP_EXTRACTION_LIMITS.maxEntryBytes) {
            fail('ZIP Worker 返回了无效输出。')
            return
          }
          outputBytes += message.size
          if (!Number.isSafeInteger(outputBytes) || outputBytes > ZIP_EXTRACTION_LIMITS.maxOutputBytes) {
            fail('ZIP 输出超过当前资源上限。')
            return
          }
          prepared.push({ type: 'file', path, size: message.size, data: message.data })
          worker.postMessage({ type: 'ack', id })
          return
        }
        if (message.type === 'complete') {
          settled = true
          finish()
          resolve(prepared)
          return
        }
        if (message.type === 'error') fail(typeof message.message === 'string' ? message.message : 'ZIP 解压失败。')
      } catch {
        fail('ZIP Worker 返回了不安全的输出。')
      }
    }
    worker.onerror = () => fail('ZIP 解压 Worker 意外停止；未向目录写入任何文件。')
    worker.postMessage({ type: 'extract', id, file })
  })
  return { result, cancel: () => { if (!settled) worker.postMessage({ type: 'cancel', id }) } }
}
