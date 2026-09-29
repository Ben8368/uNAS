import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prepareMusicDecrypt } from './musicDecryption'
const staging = vi.hoisted(() => ({ release: vi.fn(async () => {}), recover: vi.fn(async () => {}) }))
vi.mock('./musicStaging', () => ({ recoverMusicStaging: staging.recover, holdMusicStage: async () => staging.release }))
vi.mock('unas-src/runtime/extensionPlatform', () => ({ extensionApi: () => undefined }))
let worker: FakeWorker
function registerWorker(value: FakeWorker) { worker = value }
class FakeWorker {
  onmessage: ((event: { data: any }) => void) | null = null
  onerror: (() => void) | null = null
  postMessage = vi.fn()
  terminate = vi.fn()
  constructor() { registerWorker(this) }
  emit(message: Record<string, unknown>) { this.onmessage?.({ data: { id: this.postMessage.mock.calls[0][0].id, ...message } }) }
}
let directory: any
let writable: any
let output: File
beforeEach(() => {
  output = new File(['fLaC'], 'stage')
  writable = { write: vi.fn(async () => {}), close: vi.fn(async () => {}), abort: vi.fn(async () => {}) }
  directory = { removeEntry: vi.fn(async () => {}), getFileHandle: vi.fn(async () => ({ createWritable: async () => writable, getFile: async () => output })) }
  vi.stubGlobal('Worker', FakeWorker)
  vi.stubGlobal('navigator', { locks: { request() {} }, storage: { getDirectory: async () => directory } })
})
afterEach(() => vi.unstubAllGlobals())
async function started() {
  const run = prepareMusicDecrypt(new File(['test'], 'test.ncm'))
  void run.result.catch(() => {})
  await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalled())
  return run
}
describe('music cleanup and hashing', () => {
  it('starts a new leased output even when historical recovery fails', async () => {
    staging.recover.mockRejectedValueOnce(new Error('old stage locked by filesystem'))
    const run = await started()
    expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'decrypt' }))
    await run.cancel()
    expect(directory.removeEntry).toHaveBeenCalledOnce()
  })
  it('retains a failed deletion for retry and never claims cleanup succeeded', async () => {
    const run = await started()
    directory.removeEntry.mockRejectedValueOnce(new DOMException('busy', 'NoModificationAllowedError'))
    await expect(run.cancel()).rejects.toThrow('未能清理')
    await expect(run.result).rejects.toThrow('已取消')
    await expect(run.cleanup()).resolves.toBeUndefined()
    expect(directory.removeEntry).toHaveBeenCalledTimes(2)
    expect(staging.release).toHaveBeenCalledOnce()
  })
  it('cancels while stage creation is pending and cleans the late-created file', async () => {
    let finish!: () => void
    const creation = new Promise<void>(resolve => { finish = resolve })
    directory.getFileHandle.mockImplementation(async () => { await creation; return { createWritable: async () => writable, getFile: async () => output } })
    const run = prepareMusicDecrypt(new File(['test'], 'test.ncm'))
    void run.result.catch(() => {})
    await vi.waitFor(() => expect(directory.getFileHandle).toHaveBeenCalledOnce())
    const cancelled = run.cancel()
    finish()
    await cancelled
    expect(worker.postMessage).not.toHaveBeenCalled()
    expect(directory.removeEntry).toHaveBeenCalledOnce()
    expect(staging.release).toHaveBeenCalledOnce()
  })
  it('sends the OPFS snapshot to Worker hashing and retains the lease for download retry', async () => {
    const read = vi.spyOn(output, 'arrayBuffer')
    const run = await started()
    worker.emit({ type: 'started', format: 'ncm', audioBytes: 4 })
    worker.emit({ type: 'chunk', buffer: new ArrayBuffer(4), bytes: 4 })
    worker.emit({ type: 'complete', outputBytes: 4, outputFormat: 'flac', validationDepth: 'audio-signature' })
    await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'hash', file: output })))
    expect(read).not.toHaveBeenCalled()
    worker.emit({ type: 'hashed', sha256: 'a'.repeat(64) })
    await expect(run.result).resolves.toMatchObject({ outputFile: output, outputSha256: 'a'.repeat(64) })
    expect(staging.release).not.toHaveBeenCalled()
    await run.cleanup()
    expect(staging.release).toHaveBeenCalledOnce()
  })
  it('cancels during hashing without resolving a late successful result', async () => {
    const run = await started()
    worker.emit({ type: 'started', format: 'ncm', audioBytes: 0 })
    output = new File([], 'stage')
    worker.emit({ type: 'complete', outputBytes: 0, outputFormat: 'flac', validationDepth: 'audio-signature' })
    await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'hash' })))
    await run.cancel()
    await expect(run.result).rejects.toThrow('已取消')
    expect(directory.removeEntry).toHaveBeenCalledOnce()
  })
})
