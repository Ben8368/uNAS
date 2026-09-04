import type { DemoSnapshot } from 'unas-src/api/demo/contracts'
import { launchStatus } from './launchStatus'
const KEY = 'unas-demo-task-projection-v1'
export type DemoProjection = Pick<DemoSnapshot, 'executionSource' | 'scenarioId' | 'jobs'> & { ownerState: 'active' | 'closed' }
export function readProjection(): DemoProjection | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw || raw.length > 200_000) return null
    const value = JSON.parse(raw) as DemoProjection
    if (value.executionSource !== 'mock' || !Array.isArray(value.jobs) || value.jobs.length > 200 || !['active', 'closed'].includes(value.ownerState)) return null
    if (value.jobs.some((job) => !job || typeof job.id !== 'string' || job.id.length > 160 || typeof job.title !== 'string' || !['running', 'queued', 'paused', 'succeeded', 'failed', 'canceled'].includes(job.status) || job.progress && (typeof job.progress.current !== 'number' || !Number.isFinite(job.progress.current)))) return null
    return value
  } catch { return null }
}
export function writeProjection(snapshot: DemoSnapshot, ownerState: DemoProjection['ownerState'] = 'active') {
  const projection: DemoProjection = { executionSource: 'mock', scenarioId: snapshot.scenarioId, jobs: snapshot.jobs.slice(0, 200), ownerState }
  try {
    const raw = JSON.stringify(projection)
    if (raw.length > 200_000) throw new Error('摘要超过本地存储预算')
    localStorage.setItem(KEY, raw)
  } catch { launchStatus.set('无法保存本地任务摘要；其他 New Tab 可能显示旧数据。当前内存演示仍可继续。') }
}
export function observeProjection(callback: () => void) {
  const listener = (event: StorageEvent) => { if (event.key === KEY) callback() }
  window.addEventListener('storage', listener)
  return () => window.removeEventListener('storage', listener)
}
