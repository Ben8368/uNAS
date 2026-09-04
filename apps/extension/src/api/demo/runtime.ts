import type { AssetRecord, FetchTaskRecord, JobRecord, LogEntry, WorkOrder, TextLayerRecord } from '#contracts'
import { demoScenarios, type DemoScenarioId, type DemoSnapshot } from './contracts'
import { createMockFilesystem } from './filesystem'

const epoch = 1_788_480_000
const listeners = new Set<() => void>()
let sequence = 0
export const state = {
  scenarioId: 'initial-state' as DemoScenarioId, step: 0, revision: 0,
  jobs: [] as JobRecord[], tasks: [] as FetchTaskRecord[], assets: [] as AssetRecord[], logs: [] as LogEntry[],
  workOrder: {} as WorkOrder,
}
export const now = () => epoch + state.step
export const isoNow = () => new Date(now() * 1000).toISOString()
export const demoId = (prefix: string) => `demo-${prefix}-${String(++sequence).padStart(3, '0')}`
export function publish() { state.revision++; for (const listener of listeners) listener() }
export function guard(hint?: string) {
  const messages: Partial<Record<DemoScenarioId, string>> = {
    'permission-denied': 'PERMISSION_DENIED：模拟权限已拒绝。请切换演示场景后重试。',
    'resource-limit': 'RESOURCE_LIMIT：模拟资源预算不足。未读取或处理任何文件。',
    'workspace-conflict': 'OWNER_CONFLICT：模拟工作区由另一个 owner 占用。',
    'capability-unavailable': 'CAPABILITY_UNAVAILABLE：当前模拟场景不提供此能力。',
  }
  if (messages[state.scenarioId]) throw new Error(messages[state.scenarioId])
  if (state.scenarioId === 'partial-failure' && hint && /sample-document|brand-track/.test(hint)) throw new Error('MOCK_ITEM_FAILED：该静态项目用于演示部分失败，可保留失败项并切换初始场景重试。')
}
export function makeJob(kind: JobRecord['kind'], title: string, status: JobRecord['status'] = 'running', progress = 12, fixedId?: string): JobRecord {
  const id = fixedId ?? demoId('job')
  return { executionSource: 'mock', id, kind, title, status, attempt: 1, maxAttempts: 1, outputToken: `mock:output/${id}`, progress: { current: progress, total: 100, unit: 'percent' }, createdAt: now(), updatedAt: now() }
}
export function createWorkOrder(): WorkOrder {
  const record = (id: string, layerId: number, layerPath: string, text: string): TextLayerRecord => ({
    id, layerId, layerPath, soChain: [], enabled: true, originalText: text, originalFontFamily: 'Noto Sans', originalFontStyle: 'Regular', originalFontPs: 'NotoSans-Regular', originalSizePt: 28, originalLeadingPt: 34, originalTrackingValue: 0, boundsHPx: 80, boundsWPx: 480, fakesBold: false,
  })
  return { executionSource: 'mock', id: 'demo-work-order', psdPath: '/Workspace/PSD/brand-key-visual.psd', psdFileName: 'brand-key-visual.psd', documentWidth: 1920, documentHeight: 1080, documentResolution: 72, createdAt: now(), updatedAt: now(), records: [record('layer-title', 3, 'Hero/Title', '更清晰的品牌表达'), record('layer-caption', 8, 'Hero/Caption', 'Build once. Present anywhere.')] }
}
const terminal = (status: JobRecord['status']) => ['succeeded', 'failed', 'canceled'].includes(status)
export function transition(id: string, status: JobRecord['status'], errorMessage?: string) {
  const job = state.jobs.find(j => j.id === id)
  if (!job) throw new Error('演示任务不存在。')
  if (terminal(job.status)) return false
  job.status = status; job.updatedAt = now(); job.errorMessage = errorMessage
  if (status === 'succeeded') job.progress = { current: 100, total: 100, unit: 'percent' }
  for (const task of state.tasks.filter(t => t.task_id === id)) {
    task.status = status === 'succeeded' ? 'completed' : status === 'canceled' ? 'cancelled' : status === 'queued' ? 'pending' : status
    task.progress = job.progress?.current ?? 0; task.updated_at = now(); task.completed_at = terminal(status) ? now() : null
    task.stage = status === 'succeeded' ? '模拟完成（无真实输出）' : status === 'canceled' ? '模拟已取消' : status === 'failed' ? '模拟失败' : '模拟运行中'
    task.error = errorMessage ?? null
  }
  return true
}
export function log(level: string, event: string, message: string) { state.logs.unshift({ level, module: 'demo', time: isoNow(), user: '演示用户', event, message }) }
export const filesystem = createMockFilesystem(now, demoId, guard)
export function getDemoSnapshot(): DemoSnapshot {
  return structuredClone({ executionSource: 'mock', scenarioId: state.scenarioId, step: state.step, revision: state.revision, jobs: state.jobs, tasks: state.tasks, assets: state.assets.filter(asset => filesystem.hasPath(asset.path)) })
}
export function resetDemoScenario(id: DemoScenarioId): DemoSnapshot {
  if (!demoScenarios.some(s => s.id === id)) throw new Error('未知演示场景。')
  sequence = 0; state.scenarioId = id; state.step = 0; state.revision = 0
  state.jobs = [makeJob('media.transcode', '模拟品牌片结果 · 无真实输出', 'succeeded', 100, 'demo-transcode-001'), makeJob('download.video', '模拟产品发布会回放', 'running', 68, 'demo-download-001')]
  state.tasks = [{ executionSource: 'mock', id: 'demo-download-001', task_id: 'demo-download-001', title: '模拟产品发布会回放', source_url: 'https://example.com/product-launch', status: 'running', progress: 68, stage: '模拟下载进度', created_at: now(), updated_at: now(), started_at: now(), completed_at: null, params: { url: 'https://example.com/product-launch', urls: ['https://example.com/product-launch'], mode: 'video' }, output_files: [], error: null }]
  state.assets = [
    { id: 'demo-asset-001', executionSource: 'mock', kind: 'video', name: 'brand-film-h265.mp4（模拟）', path: '/Workspace/Exports/brand-film-h265.mp4', size: 84_200_000, mimeType: 'video/mp4', createdAt: isoNow(), updatedAt: isoNow() },
    { id: 'demo-asset-002', executionSource: 'mock', kind: 'audio', name: 'brand-track.mp3（模拟）', path: '/Workspace/Downloads/brand-track.mp3', size: 7_600_000, mimeType: 'audio/mpeg', createdAt: isoNow(), updatedAt: isoNow() },
    { id: 'demo-asset-003', executionSource: 'mock', kind: 'image', name: 'lumora-cover.png（模拟）', path: '/Workspace/Images/lumora-cover.png', size: 1_240_000, mimeType: 'image/png', createdAt: isoNow(), updatedAt: isoNow() },
  ]
  state.workOrder = createWorkOrder(); state.logs = []; filesystem.reset(id === 'empty-state')
  if (id === 'empty-state') { state.jobs = []; state.tasks = []; state.assets = [] }
  log('NOTICE', '已重置演示场景', `${id}：静态模拟数据，不读取或处理用户文件。`)
  if (id === 'task-failed') transition('demo-download-001', 'failed', 'MOCK_TASK_FAILED：固定失败场景，可重置重放。')
  if (id === 'task-cancelled') transition('demo-download-001', 'canceled')
  if (id === 'owner-lost') transition('demo-download-001', 'failed', 'OWNER_LOST：演示工作区已关闭，任务中断，未生成真实输出。')
  publish(); return getDemoSnapshot()
}
export function advanceDemoScenario(): DemoSnapshot {
  state.step++
  for (const job of state.jobs.filter(j => !terminal(j.status))) {
    if (state.scenarioId === 'task-failed') transition(job.id, 'failed', 'MOCK_TASK_FAILED：模拟处理失败。')
    else if (state.step % 2 === 0) transition(job.id, 'succeeded')
    else { job.progress = { current: 68, total: 100, unit: 'percent' }; transition(job.id, 'running') }
  }
  publish(); return getDemoSnapshot()
}
export function interruptDemoTasks(): DemoSnapshot {
  for (const job of state.jobs.filter(j => !terminal(j.status))) transition(job.id, 'failed', 'OWNER_LOST：演示工作区已关闭，任务中断，未生成真实输出。')
  publish(); return getDemoSnapshot()
}
export function subscribeDemo(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
resetDemoScenario('initial-state')
