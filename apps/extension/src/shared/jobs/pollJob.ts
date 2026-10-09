import type { JobRecord } from '#contracts'

const terminal = new Set<JobRecord['status']>(['succeeded', 'failed', 'canceled'])

/** Also rejects promptly when an adapter ignores its signal. */
export async function abortableRequest<T>(request: (signal: AbortSignal) => Promise<T>, parent: AbortSignal, timeoutMs = 15_000): Promise<T> {
  const controller = new AbortController()
  const abort = () => controller.abort(parent.reason ?? new DOMException('观察已中止', 'AbortError'))
  if (parent.aborted) abort()
  else parent.addEventListener('abort', abort, { once: true })
  const timeout = setTimeout(() => controller.abort(new Error('请求超时；任务状态未知，请在任务中心查看。')), timeoutMs)
  let onAbort: () => void = () => undefined
  try {
    return await new Promise<T>((resolve, reject) => {
      onAbort = () => reject(controller.signal.reason)
      if (controller.signal.aborted) return onAbort()
      controller.signal.addEventListener('abort', onAbort, { once: true })
      Promise.resolve().then(() => {
        if (controller.signal.aborted) throw controller.signal.reason
        return request(controller.signal)
      }).then(resolve, reject)
    })
  } finally {
    clearTimeout(timeout)
    parent.removeEventListener('abort', abort)
    controller.signal.removeEventListener('abort', onAbort)
  }
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(signal.reason) }
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, ms)
    if (signal.aborted) abort()
    else signal.addEventListener('abort', abort, { once: true })
  })
}

export async function pollJob(
  jobId: string,
  query: (id: string, signal?: AbortSignal) => Promise<{ job?: JobRecord | null }>,
  signal: AbortSignal,
  timeoutMs = 300_000,
): Promise<JobRecord> {
  const deadline = Date.now() + timeoutMs
  while (!signal.aborted && Date.now() < deadline) {
    const result = await abortableRequest((requestSignal) => query(jobId, requestSignal), signal, Math.min(15_000, deadline - Date.now()))
    if (!result.job) throw new Error('任务记录不存在或已被清理。')
    if (terminal.has(result.job.status)) return result.job
    await wait(Math.min(500, Math.max(0, deadline - Date.now())), signal)
  }
  if (signal.aborted) throw signal.reason
  throw new Error('任务观察超时；任务可能仍在执行，请在任务中心查看或取消。')
}
