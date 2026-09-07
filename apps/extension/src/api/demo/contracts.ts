import type { AssetRecord, FetchTaskRecord, JobRecord, PathGrantInfo } from '#contracts'

export type MockFileMetadata = { fixtureId: 'sample-image' | 'sample-document' | 'sample-video'; executionSource: 'mock' }
export type PathGrantCapabilityResult =
  | { status: 'granted'; executionSource: 'mock'; grant: PathGrantInfo }
  | { status: 'unavailable' | 'denied'; executionSource: 'mock'; reason: string }
export const demoScenarios = [
  { id: 'initial-state', label: '初始演示' },
  { id: 'empty-state', label: '空工作区' },
  { id: 'task-running', label: '任务运行与完成' },
  { id: 'task-failed', label: '任务失败' },
  { id: 'task-cancelled', label: '任务已取消' },
  { id: 'owner-lost', label: '工作区关闭后任务中断' },
  { id: 'permission-denied', label: '权限拒绝' },
  { id: 'capability-unavailable', label: '能力不可用' },
  { id: 'resource-limit', label: '资源预算不足' },
  { id: 'workspace-conflict', label: '工作区所有权冲突' },
  { id: 'partial-failure', label: '批量部分失败' },
] as const
export type DemoScenarioId = typeof demoScenarios[number]['id']
export type DemoSnapshot = {
  executionSource: 'mock'; scenarioId: DemoScenarioId; step: number; revision: number
  jobs: JobRecord[]; tasks: FetchTaskRecord[]; assets: AssetRecord[]
  hasPendingUserTasks: boolean
}
