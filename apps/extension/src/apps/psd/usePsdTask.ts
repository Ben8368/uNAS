import { useCallback, useEffect, useRef, useState } from 'react'
import { cancelJob, getJob } from 'unas-src/api'
import { abortableRequest, pollJob } from 'unas-src/application/pollJob'

/** Closing the view stops observation, never claims that the task was cancelled. */
export function usePsdTask() {
  const controller = useRef<AbortController>()
  const mounted = useRef(true)
  const [jobId, setJobId] = useState<string | null>(null)
  const [cancelMessage, setCancelMessage] = useState('')
  const [cancelling, setCancelling] = useState(false)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; controller.current?.abort() }
  }, [])

  const begin = useCallback(() => {
    controller.current?.abort()
    const next = new AbortController()
    controller.current = next
    setJobId(null)
    setCancelMessage('')
    return next.signal
  }, [])
  const observe = useCallback(async (id: string, signal: AbortSignal) => {
    if (signal.aborted) throw signal.reason
    setJobId(id)
    const result = await pollJob(id, getJob, signal)
    if (!signal.aborted) setJobId(null)
    return result
  }, [])
  const cancel = useCallback(async () => {
    if (!jobId || cancelling) return
    setCancelling(true)
    setCancelMessage('正在请求取消；尚未确认任务终态。')
    const signal = controller.current?.signal
    if (!signal) return
    try {
      await abortableRequest(() => cancelJob(jobId), signal)
      const result = await abortableRequest((requestSignal) => getJob(jobId, requestSignal), signal)
      if (signal.aborted) return
      setCancelMessage(result.job?.status === 'canceled'
        ? '任务已确认取消。'
        : result.job?.status === 'succeeded'
          ? '任务已完成，取消未生效。'
          : '取消请求已发送，尚未确认取消终态；请继续观察任务中心。')
      if (result.job && ['succeeded', 'failed', 'canceled'].includes(result.job.status)) setJobId(null)
    } catch (error) {
      if (!signal.aborted) setCancelMessage(`取消请求失败：${error instanceof Error ? error.message : '未知错误'}。任务可能仍在执行。`)
    } finally {
      if (mounted.current) setCancelling(false)
    }
  }, [jobId, cancelling])
  return { begin, observe, cancel, jobId, cancelling, cancelMessage, mounted }
}
