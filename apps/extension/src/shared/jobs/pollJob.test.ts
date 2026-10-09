import { afterEach, describe, expect, it, vi } from 'vitest'
import type { JobRecord } from '#contracts'
import { abortableRequest, pollJob } from './pollJob'

afterEach(() => vi.useRealTimers())
const job = (status: JobRecord['status']) => ({ id: 'job-test', status }) as JobRecord

describe('task observation lifecycle', () => {
  it('stops querying on view close without issuing task cancellation', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const query = vi.fn(async () => ({ job: job('running') }))
    const promise = pollJob('job-test', query, controller.signal)
    const rejected = expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    await vi.advanceTimersByTimeAsync(0)
    controller.abort()
    await rejected
    await vi.advanceTimersByTimeAsync(30_000)
    expect(query).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('times out a hanging adapter and aborts its request signal', async () => {
    vi.useFakeTimers()
    let requestSignal: AbortSignal | undefined
    const pending = abortableRequest((signal) => { requestSignal = signal; return new Promise(() => undefined) }, new AbortController().signal, 100)
    const rejected = expect(pending).rejects.toThrow('请求超时')
    await vi.advanceTimersByTimeAsync(100)
    await rejected
    expect(requestSignal?.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('returns the actual terminal status after cancellation is requested', async () => {
    vi.useFakeTimers()
    const query = vi.fn().mockResolvedValueOnce({ job: job('running') }).mockResolvedValueOnce({ job: job('canceled') })
    const result = pollJob('job-test', query, new AbortController().signal)
    await vi.advanceTimersByTimeAsync(500)
    expect((await result).status).toBe('canceled')
    expect(vi.getTimerCount()).toBe(0)
  })
})
