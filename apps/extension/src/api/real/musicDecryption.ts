import { holdMusicStage, recoverMusicStaging } from './musicStaging'
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
  if (typeof navigator.locks?.request !== 'function') reasons.push('当前浏览器没有音乐暂存所有权锁能力。')
  if (typeof Worker !== 'function') reasons.push('当前页面没有 Dedicated Worker。')
  const storage = (globalThis as typeof globalThis & { navigator?: { storage?: StorageWithOpfs } }).navigator?.storage
  if (typeof storage?.getDirectory !== 'function') reasons.push('当前浏览器没有 OPFS 临时文件能力。')
  if (typeof globalThis.crypto?.subtle?.digest !== 'function') reasons.push('当前浏览器没有可用的 SHA-256 输出一致性校验能力。')
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
  let stopped = false
  let writable: OpfsWritable | undefined
  let directory: OpfsDirectory | undefined
  let releaseLease: (() => Promise<void>) | undefined
  const temporaryName = `unas-music-${id}.stage`
  let cleanupPromise: Promise<void> | undefined
  let resolveResult!: (value: MusicDecryptResult) => void
  let rejectResult!: (reason: unknown) => void
  let outputBytes = 0
  let started: Extract<MusicWorkerMessage, { type: 'started' }> | undefined
  let completed: Extract<MusicWorkerMessage, { type: 'complete' }> | undefined
  let outputFile: File | undefined
  let pending = Promise.resolve()
  let setup: Promise<void> = Promise.resolve()
  const result = new Promise<MusicDecryptResult>((resolve, reject) => { resolveResult = resolve; rejectResult = reject })
  const finishWorker = () => { worker.onmessage = null; worker.onerror = null; worker.terminate() }
  const stop = () => {
    stopped = true
    finishWorker()
    if (!settled) { settled = true; rejectResult(new Error('已取消；输出未提交。')) }
  }
  const cleanup = async (): Promise<void> => {
    stop()
    if (cleanupPromise) return cleanupPromise
    const cleaning = (async () => {
      await setup
      await pending
      try {
        try { await writable?.abort?.() } finally { writable = undefined }
        if (directory) {
          try { await directory.removeEntry(temporaryName) }
          catch (error) { if (!(error instanceof DOMException && error.name === 'NotFoundError')) throw error }
          directory = undefined
        }
      } catch {
        throw new Error('音乐暂存未能清理；请重试清理或重新打开音乐应用。')
      } finally {
        await releaseLease?.()
        releaseLease = undefined
      }
    })()
    cleanupPromise = cleaning
    try { await cleaning } finally { if (cleanupPromise === cleaning) cleanupPromise = undefined }
  }
  const fail = (reason: unknown) => {
    if (settled) return
    settled = true
    rejectResult(reason instanceof Error ? reason : new Error(String(reason)))
    void cleanup().catch(() => { /* Retain directory for explicit retry; recovery can also reclaim it. */ })
  }
  const handleMessage = async (message: MusicWorkerMessage) => {
    if (!message || message.id !== id || stopped || settled) return
    if (message.type === 'started') { started = message; return }
    if (message.type === 'chunk') {
      if (!(message.buffer instanceof ArrayBuffer) || message.bytes !== message.buffer.byteLength || message.bytes > MUSIC_LIMITS.workerChunkBytes || !writable) throw new Error('音乐 Worker 返回了无效分块。')
      outputBytes += message.bytes
      if (!Number.isSafeInteger(outputBytes) || outputBytes > MUSIC_LIMITS.maxOutputBytes) throw new Error('解密输出超过 128 MiB 资源预算。')
      await writable.write(message.buffer)
      if (stopped) return
      onProgress?.({ processedBytes: outputBytes, totalBytes: started?.audioBytes ?? MUSIC_LIMITS.maxOutputBytes })
      worker.postMessage({ type: 'ack', id } satisfies MusicWorkerRequest)
      return
    }
    if (message.type === 'complete') {
      if (!writable || !started || message.outputBytes !== outputBytes) throw new Error('音乐 Worker 完成结果与 staged 输出不一致。')
      await writable.close()
      writable = undefined
      if (stopped) return
      if (!directory) throw new Error('OPFS staged 输出已丢失。')
      const snapshot = await directory.getFileHandle(temporaryName).then(handle => handle.getFile())
      outputFile = snapshot
      if (snapshot.size !== outputBytes) throw new Error('OPFS staged 输出大小与 Worker 结果不一致。')
      if (stopped) return
      completed = message
      worker.postMessage({ type: 'hash', id, file: snapshot } satisfies MusicWorkerRequest)
      return
    }
    if (message.type === 'hashed') {
      if (!started || !completed || !outputFile || !/^[0-9a-f]{64}$/.test(message.sha256)) throw new Error('音乐输出校验结果无效。')
      settled = true
      finishWorker()
      resolveResult({ format: started.format, outputFormat: completed.outputFormat, validationDepth: completed.validationDepth,
        inputBytes: file.size, outputBytes, outputSha256: message.sha256, outputFile })
      return
    }
    if (message.type === 'error') throw new Error(message.message)
  }
  worker.onmessage = (event: MessageEvent<MusicWorkerMessage>) => {
    pending = pending.then(() => handleMessage(event.data)).catch(fail)
  }
  worker.onerror = () => fail(new Error('音乐 Worker 意外停止；请清理暂存后重试。'))
  setup = (async () => {
    try {
      // Historical cleanup is best effort; MusicApp reports recovery errors independently.
      // A stuck orphan must not prevent creating a separately leased output.
      await recoverMusicStaging().catch(() => {})
      if (stopped) return
      releaseLease = await holdMusicStage(temporaryName)
      if (stopped) return
      directory = await opfsStorage().getDirectory!()
      if (stopped) return
      const handle = await directory.getFileHandle(temporaryName, { create: true })
      if (stopped) return
      writable = await handle.createWritable()
      if (stopped) return
      worker.postMessage({ type: 'decrypt', id, file } satisfies MusicWorkerRequest)
    } catch (error) { fail(error) }
  })()
  return { result, cancel: cleanup, cleanup }
}
