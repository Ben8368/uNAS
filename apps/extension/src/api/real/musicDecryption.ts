import { extensionApi } from 'unas-src/runtime/extensionPlatform'
import { MUSIC_LIMITS, type MusicCapability, type MusicDecryptResult, type MusicWorkerMessage, type MusicWorkerRequest } from 'unas-src/music/types'

type OpfsDirectory = {
  getFileHandle(name: string, options?: { create?: boolean }): Promise<OpfsFileHandle>
  removeEntry(name: string): Promise<void>
}
type OpfsFileHandle = {
  getFile(): Promise<File>
  createWritable(): Promise<OpfsWritable>
}
type OpfsWritable = {
  write(data: ArrayBuffer): Promise<void>
  close(): Promise<void>
  abort?(): Promise<void>
}
type StorageWithOpfs = { getDirectory?: () => Promise<OpfsDirectory> }

export type MusicDecryptRun = {
  result: Promise<MusicDecryptResult>
  cancel: () => Promise<void>
  cleanup: () => Promise<void>
}

export type MusicProgress = { processedBytes: number; totalBytes: number }

export function probeMusicCapability(): MusicCapability {
  const reasons: string[] = []
  if (typeof Worker !== 'function') reasons.push('当前页面没有 Dedicated Worker。')
  const storage = (globalThis as typeof globalThis & { navigator?: { storage?: StorageWithOpfs } }).navigator?.storage
  if (typeof storage?.getDirectory !== 'function') reasons.push('当前浏览器没有 OPFS 临时文件能力。')
  return {
    supported: reasons.length === 0,
    reasons,
    limits: {
      maxInputBytes: MUSIC_LIMITS.maxInputBytes,
      maxOutputBytes: MUSIC_LIMITS.maxOutputBytes,
      workerChunkBytes: MUSIC_LIMITS.workerChunkBytes,
      opfsStaging: reasons.length === 0,
    },
  }
}

function workerUrl() {
  return extensionApi()?.runtime?.getURL('/music-worker.js') ?? new URL('../../workers/musicDecrypt.worker.ts', import.meta.url)
}

function opfsStorage() {
  const storage = (globalThis as typeof globalThis & { navigator?: { storage?: StorageWithOpfs } }).navigator?.storage
  if (typeof storage?.getDirectory !== 'function') throw new Error('当前浏览器没有 OPFS 临时文件能力。')
  return storage
}

export function prepareMusicDecrypt(file: File, onProgress?: (progress: MusicProgress) => void): MusicDecryptRun {
  const capability = probeMusicCapability()
  if (!capability.supported) return { result: Promise.reject(new Error(capability.reasons.join(' '))), cancel: async () => undefined, cleanup: async () => undefined }
  if (file.size > MUSIC_LIMITS.maxInputBytes) return { result: Promise.reject(new Error('输入超过 128 MiB 资源预算。')), cancel: async () => undefined, cleanup: async () => undefined }

  const id = crypto.randomUUID()
  const worker = new Worker(workerUrl(), { type: 'module', name: 'unas-music-decrypt' })
  let settled = false
  let cancelRequested = false
  let writable: OpfsWritable | undefined
  let directory: OpfsDirectory | undefined
  const temporaryName = `unas-music-${id}.stage`
  let cleanupPromise: Promise<void> | undefined
  let resolveResult: (value: MusicDecryptResult) => void = () => undefined
  let rejectResult: (reason: unknown) => void = () => undefined
  let outputBytes = 0
  let started: Extract<MusicWorkerMessage, { type: 'started' }> | undefined

  const finishWorker = () => { worker.onmessage = null; worker.onerror = null; worker.terminate() }
  const cleanupStage = async (): Promise<void> => {
    if (cleanupPromise) {
      await cleanupPromise
      if (writable || directory) await cleanupStage()
      return
    }
    const pending = (async () => {
      try { await writable?.abort?.() } catch { /* Cleanup remains best effort after browser abort. */ }
      writable = undefined
      if (directory) { try { await directory.removeEntry(temporaryName) } catch { /* Missing staging entry is already clean. */ } }
      directory = undefined
    })()
    cleanupPromise = pending
    try { await pending } finally { if (cleanupPromise === pending) cleanupPromise = undefined }
    if (writable || directory) await cleanupStage()
  }
  const fail = (reason: unknown) => {
    if (settled) return
    settled = true
    finishWorker()
    void cleanupStage()
    rejectResult(reason instanceof Error ? reason : new Error(String(reason)))
  }

  const result = new Promise<MusicDecryptResult>((resolve, reject) => {
    resolveResult = resolve; rejectResult = reject
    worker.onmessage = (event: MessageEvent<MusicWorkerMessage>) => {
      const message = event.data
      if (!message || message.id !== id || settled) return
      if (message.type === 'started') { started = message; return }
      if (message.type === 'chunk') {
        if (!(message.buffer instanceof ArrayBuffer) || message.bytes !== message.buffer.byteLength || message.bytes > MUSIC_LIMITS.workerChunkBytes || !writable) { fail(new Error('音乐 Worker 返回了无效分块。')); return }
        outputBytes += message.bytes
        if (!Number.isSafeInteger(outputBytes) || outputBytes > MUSIC_LIMITS.maxOutputBytes) { fail(new Error('解密输出超过 128 MiB 资源预算。')); return }
        void writable.write(message.buffer).then(() => { onProgress?.({ processedBytes: outputBytes, totalBytes: started?.audioBytes ?? MUSIC_LIMITS.maxOutputBytes }); worker.postMessage({ type: 'ack', id } satisfies MusicWorkerRequest) }, fail)
        return
      }
      if (message.type === 'complete') {
        if (!writable || !started || message.outputBytes !== outputBytes) { fail(new Error('音乐 Worker 完成结果与 staged 输出不一致。')); return }
        void writable.close().then(async () => {
          writable = undefined
          const outputHandle = directory
          if (!outputHandle) throw new Error('OPFS staged 输出已丢失。')
          const outputFile = await outputHandle.getFileHandle(temporaryName).then((handle) => handle.getFile())
          settled = true; finishWorker()
          resolveResult({ format: started!.format, outputFormat: message.outputFormat, inputBytes: file.size, outputBytes, outputFile })
        }).catch(fail)
        return
      }
      if (message.type === 'error') fail(new Error(message.message))
    }
    worker.onerror = () => fail(new Error('音乐 Worker 意外停止；临时输出已清理。'))
  })

  const setup = (async () => {
    try {
      directory = await opfsStorage().getDirectory!()
      if (cancelRequested || settled) { await cleanupStage(); return }
      const handle = await directory.getFileHandle(temporaryName, { create: true })
      writable = await handle.createWritable()
      if (cancelRequested || settled) { await cleanupStage(); return }
      worker.postMessage({ type: 'decrypt', id, file } satisfies MusicWorkerRequest)
    } catch (error) { fail(error) }
  })()
  void setup

  return {
    result,
    cancel: async () => {
      if (settled || cancelRequested) return
      cancelRequested = true
      worker.postMessage({ type: 'cancel', id } satisfies MusicWorkerRequest)
      await cleanupStage()
      if (!settled) fail(new Error('已取消；临时输出已清理。'))
    },
    cleanup: async () => {
      if (!settled) { cancelRequested = true; worker.postMessage({ type: 'cancel', id } satisfies MusicWorkerRequest) }
      finishWorker()
      await cleanupStage()
    },
  }
}
