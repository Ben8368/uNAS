import { afterEach, describe, expect, it, vi } from 'vitest'

import { prepareZipExtraction } from './zipExtraction'

class HeldWorker {
  static latest: HeldWorker | undefined
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  readonly messages: unknown[] = []
  terminated = false

  constructor() { HeldWorker.latest = this }

  postMessage(message: unknown) { this.messages.push(message) }

  terminate() { this.terminated = true }
}

describe('ZIP preparation cancellation', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('terminates a non-cooperative Worker and releases the staged result before commit', async () => {
    vi.stubGlobal('Worker', HeldWorker)
    const run = prepareZipExtraction(new Blob(['synthetic ZIP input']) as File)
    const worker = HeldWorker.latest
    expect(worker?.messages).toHaveLength(1)

    run.cancel()

    await expect(run.result).rejects.toThrow('已取消解压；未向目录写入任何文件。')
    expect(worker?.terminated).toBe(true)
    expect(worker?.onmessage).toBeNull()
    expect(worker?.onerror).toBeNull()
    expect(worker?.messages).toHaveLength(1)
  })
})
