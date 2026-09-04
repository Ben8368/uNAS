import { useEffect, useState } from 'react'
import { getDemoSnapshot, interruptDemoTasks, subscribeDemo } from 'unas-src/api'
import { claimWorkspace } from 'unas-src/runtime/workspaceSession'
import { writeProjection } from 'unas-src/runtime/demoProjection'
export function useWorkspaceSession(workspace: boolean) {
  const [state, setState] = useState<'owner' | 'conflict' | 'unavailable' | 'pending'>(workspace ? 'pending' : 'unavailable')
  const [attempt, retry] = useState(0)
  useEffect(() => {
    if (!workspace) return
    return claimWorkspace(navigator.locks, setState)
  }, [workspace, attempt])
  useEffect(() => {
    if (state !== 'owner') return
    writeProjection(getDemoSnapshot())
    const unsubscribe = subscribeDemo(() => writeProjection(getDemoSnapshot()))
    const close = () => { interruptDemoTasks(); writeProjection(getDemoSnapshot(), 'closed') }
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (getDemoSnapshot().jobs.some((job) => ['running', 'queued'].includes(job.status))) { event.preventDefault(); event.returnValue = '' }
    }
    window.addEventListener('pagehide', close)
    window.addEventListener('beforeunload', beforeUnload)
    return () => { unsubscribe(); writeProjection(getDemoSnapshot(), 'closed'); window.removeEventListener('pagehide', close); window.removeEventListener('beforeunload', beforeUnload) }
  }, [state])
  return { state, retry: () => retry((value) => value + 1) }
}
