/// <reference lib="webworker" />

import {
  createKgmCipher,
  createQmcCipher,
  decryptKgmChunk,
  decryptNcmChunk,
  decryptQmcChunk,
  detectAudio,
  getKgmMagic,
  getNcmMagic,
  parseKgmHeader,
  parseNcmHeader,
  parseQmcFooter,
  type QmcCipher,
} from 'unas-src/features/music/algorithms'
import { parseQmcKeyFile, selectQmcKey, type QmcKeyMap } from 'unas-src/features/music/qmcKeys'
import { MUSIC_LIMITS, type MusicWorkerMessage, type MusicWorkerRequest, type MusicOutputFormat, type MusicKeySource } from 'unas-src/features/music/types'

type ActiveJob = { id: string; controller: AbortController; ack?: Promise<void>; acknowledge?: () => void; rejectAck?: (reason: unknown) => void }
let active: ActiveJob | undefined

self.addEventListener('message', (event: MessageEvent<MusicWorkerRequest>) => {
  const request = event.data
  if (!request || typeof request !== 'object' || typeof request.id !== 'string') return
  if (request.type === 'cancel') {
    if (active?.id === request.id) { active.controller.abort(); active.rejectAck?.(new DOMException('已取消；临时输出将被清理。', 'AbortError')) }
    return
  }
  if (request.type === 'ack') {
    if (active?.id === request.id) active.acknowledge?.()
    return
  }
  if (active) {
    post({ type: 'error', id: request.id, code: 'busy', message: '已有本地音乐任务正在执行。' })
    return
  }
  if (request.type === 'hash') {
    void hashOutput(request)
    return
  }
  void decrypt(request)
})

function post(message: MusicWorkerMessage, transfer: Transferable[] = []) {
  self.postMessage(message, transfer)
}

async function readRange(file: File, start: number, length: number) {
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(length) || start < 0 || length < 0 || start + length > file.size) throw new Error('输入区段超出文件范围。')
  return new Uint8Array(await file.slice(start, start + length).arrayBuffer())
}

async function readQmcKeys(keyFile: File | undefined): Promise<QmcKeyMap> {
  if (!keyFile) return new Map()
  if (!(keyFile instanceof File)) throw new Error('ekey 清单不是有效的本地文件。')
  if (keyFile.size <= 0) throw new Error('ekey 清单为空。')
  if (keyFile.size > MUSIC_LIMITS.maxKeyFileBytes) throw new Error('ekey 清单超过 1 MiB 资源预算。')
  return parseQmcKeyFile(await keyFile.text())
}

function abortIfNeeded(controller: AbortController) {
  if (controller.signal.aborted) throw new DOMException('已取消；临时输出将被清理。', 'AbortError')
}

function outputFormat(value: string | undefined): MusicOutputFormat {
  return value === 'flac' || value === 'mp3' || value === 'ogg' || value === 'wav' ? value : 'unknown'
}

async function decrypt(request: Extract<MusicWorkerRequest, { type: 'decrypt' }>) {
  const controller = new AbortController()
  active = { id: request.id, controller }
  try {
    const file = request.file
    if (!(file instanceof File) || !Number.isSafeInteger(file.size) || file.size <= 0) throw new Error('输入不是有效的本地文件。')
    if (file.size > MUSIC_LIMITS.maxInputBytes) throw new Error('输入超过 128 MiB 资源预算。')
    const prefix = await readRange(file, 0, Math.min(file.size, 64))
    abortIfNeeded(controller)

    let format: 'kgm-v3' | 'ncm' | 'qmc'
    let audioOffset: number
    let audioBytes: number
    let outputFormat: MusicOutputFormat = 'unknown'
    let cipherKind: string | undefined
    let keySource: MusicKeySource | undefined
    let keyFileProvided = false
    let decryptChunk: (chunk: Uint8Array, offset: number) => Uint8Array

    if (startsWith(prefix, getKgmMagic())) {
      format = 'kgm-v3'
      const header = await readRange(file, 0, 60)
      const parsed = parseKgmHeader(header)
      if (parsed.audioOffset >= file.size) throw new Error('KGM 音频区段为空。')
      const cipher = createKgmCipher(header)
      audioOffset = parsed.audioOffset; audioBytes = file.size - audioOffset; outputFormat = 'flac'; cipherKind = 'kgm-v3'
      decryptChunk = (chunk, offset) => decryptKgmChunk(chunk, cipher, offset)
    } else if (startsWith(prefix, getNcmMagic())) {
      format = 'ncm'
      const first = await readRange(file, 0, 14)
      const keyLength = readLe(first, 10)
      if (keyLength > MUSIC_LIMITS.maxSectionBytes) throw new Error('NCM key 区段超过资源预算。')
      const key = await readRange(file, 14, keyLength)
      const metaLengthBytes = await readRange(file, 14 + keyLength, 4)
      const metaLength = readLe(metaLengthBytes, 0)
      if (metaLength > MUSIC_LIMITS.maxSectionBytes) throw new Error('NCM metadata 区段超过资源预算。')
      const metadata = await readRange(file, 14 + keyLength + 4, metaLength)
      const coverOffset = 14 + keyLength + 4 + metaLength + 5
      const coverHeader = await readRange(file, coverOffset, 8)
      const parsed = parseNcmHeader(concat(first, key, metaLengthBytes, metadata, new Uint8Array(5), coverHeader), file.size)
      audioOffset = parsed.audioOffset; audioBytes = file.size - audioOffset; outputFormat = outputFormatFor(parsed.metadataFormat)
      decryptChunk = (chunk, offset) => decryptNcmChunk(chunk, parsed.keyBox, offset)
    } else {
      format = 'qmc'
      keyFileProvided = Boolean(request.keyFile)
      const tailLength = Math.min(file.size, MUSIC_LIMITS.maxFooterBytes + 8)
      const tail = await readRange(file, file.size - tailLength, tailLength)
      const footer = parseQmcFooter(tail, file.size)
      // Embedded raw-key/QTag files do not need the user manifest; only read
      // the manifest when the footer actually requires an imported key.
      const keys = footer.footer === 'musicex' || footer.footer === 'static' ? await readQmcKeys(request.keyFile) : new Map<string, string>()
      const selection = selectQmcKey(footer, file.name, keys)
      let cipher: QmcCipher
      try {
        cipher = createQmcCipher(selection.rawKey)
      } catch (error) {
        if (selection.keySource === 'imported') throw new Error('导入的 ekey 无法用于该文件；请检查清单中的文件名和 ekey。', { cause: error })
        throw error
      }
      keySource = selection.keySource
      audioOffset = 0; audioBytes = footer.audioBytes; cipherKind = cipher.kind
      decryptChunk = (chunk, offset) => decryptQmcChunk(chunk, cipher, offset)
    }

    if (audioBytes <= 0 || audioBytes > MUSIC_LIMITS.maxOutputBytes) throw new Error('解密输出超过资源预算或为空。')
    post({ type: 'started', id: request.id, format, outputFormat, inputBytes: file.size, audioBytes, ...(cipherKind ? { cipher: cipherKind } : {}), ...(keySource ? { keySource } : {}) })

    let position = audioOffset; let outputBytes = 0; let first = new Uint8Array()
    while (position < file.size && outputBytes < audioBytes) {
      abortIfNeeded(controller)
      const length = Math.min(MUSIC_LIMITS.workerChunkBytes, audioBytes - outputBytes)
      const encrypted = await readRange(file, position, length)
      abortIfNeeded(controller)
      const decoded = decryptChunk(encrypted, outputBytes)
      outputBytes += decoded.length; position += decoded.length
      if (first.length < 16) { const merged = new Uint8Array(Math.min(16, first.length + decoded.length)); merged.set(first); merged.set(decoded.subarray(0, merged.length - first.length), first.length); first = merged }
      await emitChunkAndWait(request.id, decoded)
    }
    const detected = detectAudio(first)
    if (detected.format === 'unknown') {
      const hint = keySource === 'imported'
        ? '；请检查 ekey 清单中的值是否与该文件匹配。'
        : keySource === 'static' && keyFileProvided ? '；ekey 清单中没有匹配该文件名的条目，或该文件不需要 key。' : ''
      throw new Error(`解密输出签名无法识别：${detected.magic}${hint}`)
    }
    post({ type: 'complete', id: request.id, outputBytes, outputFormat: detected.format, validationDepth: 'audio-signature' })
  } catch (error) {
    const cancelled = error instanceof DOMException && error.name === 'AbortError'
    post({ type: 'error', id: request.id, code: cancelled ? 'cancelled' : 'processing-failed', message: cancelled ? '已取消；临时输出将被清理。' : error instanceof Error ? error.message : '本地音乐解密失败。' })
  } finally {
    active = undefined
  }
}

function emitChunkAndWait(id: string, decoded: Uint8Array) {
  return new Promise<void>((resolve, reject) => {
    if (!active || active.id !== id || active.controller.signal.aborted) { reject(new DOMException('已取消；临时输出将被清理。', 'AbortError')); return }
    const transferable = decoded.slice().buffer
    active.ack = new Promise<void>((acknowledge, reject) => { active!.acknowledge = acknowledge; active!.rejectAck = reject })
    post({ type: 'chunk', id, buffer: transferable, bytes: transferable.byteLength }, [transferable])
    active.ack.then(resolve, reject).finally(() => { if (active?.id === id) { active.ack = undefined; active.acknowledge = undefined; active.rejectAck = undefined } })
  })
}

function startsWith(value: Uint8Array, prefix: Uint8Array) {
  if (value.length < prefix.length) return false
  for (let index = 0; index < prefix.length; index += 1) if (value[index] !== prefix[index]) return false
  return true
}

function readLe(bytes: Uint8Array, offset: number) {
  return (bytes[offset] | bytes[offset + 1] << 8 | bytes[offset + 2] << 16 | bytes[offset + 3] * 0x1000000) >>> 0
}

function concat(...parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0); const result = new Uint8Array(total); let offset = 0
  for (const part of parts) { result.set(part, offset); offset += part.length }
  return result
}

function outputFormatFor(value: string | undefined): MusicOutputFormat {
  return outputFormat(value)
}

/** Hash the committed OPFS snapshot in the Worker, never allocate its full buffer in the UI realm. */
async function hashOutput(request: Extract<MusicWorkerRequest, { type: 'hash' }>) {
  active = { id: request.id, controller: new AbortController() }
  try {
    if (request.file.size > MUSIC_LIMITS.maxOutputBytes) throw new Error('音乐输出超过校验预算。')
    const digest = await crypto.subtle.digest('SHA-256', await request.file.arrayBuffer())
    post({ type: 'hashed', id: request.id, sha256: Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('') })
  } catch {
    post({ type: 'error', id: request.id, code: 'hash-failed', message: '音乐输出一致性校验失败。' })
  } finally { active = undefined }
}
