import type { FetchTaskRecord, JobRecord } from '#contracts'
import type { UnasDemoApi, PathGrantCapabilityResult } from './types'
import {
  state, now, makeJob, guard, transition, log, filesystem, publish, userJobIds,
  getDemoSnapshot, resetDemoScenario, advanceDemoScenario, subscribeDemo, interruptDemoTasks,
} from './demo/runtime'

function createJob(kind: JobRecord['kind'], title: string) {
  guard()
  const job = makeJob(kind, title)
  state.jobs.unshift(job)
  userJobIds.add(job.id)
  if (state.scenarioId === 'task-failed') transition(job.id, 'failed', 'MOCK_TASK_FAILED：固定失败场景。')
  return structuredClone(job)
}
function grant(kind: 'file.read' | 'file.write'): PathGrantCapabilityResult {
  if (state.scenarioId === 'permission-denied') return { status: 'denied', executionSource: 'mock', reason: '模拟授权已拒绝；未打开真实文件选择器。' }
  if (state.scenarioId === 'capability-unavailable') return { status: 'unavailable', executionSource: 'mock', reason: '当前演示场景不包含真实文件授权能力。' }
  return { status: 'granted', executionSource: 'mock', grant: { id: `mock-grant-${kind}`, kind, status: 'active', displayName: kind === 'file.read' ? '内置模拟输入' : '模拟结果（无真实输出）', createdAt: now(), updatedAt: now(), expiresAt: now() + 3600 } }
}

/** Fixed metadata scenarios only. Every successful execution is explicitly mock. */
const implementation = {
  getDemoSnapshot, resetDemoScenario, advanceDemoScenario, subscribeDemo, interruptDemoTasks,
  async requestReadGrant() { return grant('file.read') },
  async requestWriteGrant() { return grant('file.write') },
  async submitDemoTool(kind, fixtureId) {
    const kinds = { image: 'image.convert', pdf: 'pdf.extract', archive: 'archive.create' } as const
    if (!Object.prototype.hasOwnProperty.call(kinds, kind)) throw new Error('未知模拟工具。')
    return createJob(kinds[kind], `模拟 ${kind} · ${fixtureId ?? '内置 fixture'} · 无真实输出`)
  },
  async submitFetch(draft) {
    guard()
    if (draft.cookies_from_browser) throw new Error('CAPABILITY_UNAVAILABLE：Demo 不读取浏览器登录态或 Cookie。')
    const outputDirectory = draft.output_dir || '/Workspace/Downloads'
    await filesystem.listFilebrowserDirectory({ directory: outputDirectory })
    const urls = draft.urls?.filter(Boolean) ?? (draft.url ? [draft.url] : [])
    if (urls.length === 0 || urls.length > 20) throw new Error('每批模拟任务需要 1–20 个 HTTPS URL。')
    const parsed = urls.map(url => { const next = new URL(url); if (next.protocol !== 'https:') throw new Error('模拟任务仅接受 HTTPS URL。'); return next })
    const newTasks = parsed.map(url => {
      const job = createJob(draft.mode === 'audio' ? 'download.audio' : 'download.video', `模拟下载 · ${url.hostname}`)
      const task: FetchTaskRecord = { executionSource: 'mock', id: job.id, task_id: job.id, title: job.title, source_url: url.href, status: job.status === 'failed' ? 'failed' : 'running', progress: 12, stage: job.status === 'failed' ? '模拟失败' : '模拟等待中', created_at: now(), updated_at: now(), started_at: now(), completed_at: job.status === 'failed' ? now() : null, params: { url: url.href, urls: [url.href], mode: draft.mode ?? 'video', output_dir: outputDirectory, compatible_format: draft.compatible_format ?? false, max_concurrent: draft.max_concurrent ?? 1 }, output_files: [], error: job.errorMessage ?? null }
      return task
    })
    state.tasks.unshift(...newTasks); log('NOTICE', '创建模拟下载任务', `创建 ${newTasks.length} 个静态模拟任务；不会请求 URL。`)
    return { ok: true, task_id: newTasks[0]?.task_id, task_ids: newTasks.map(t => t.task_id), status: newTasks[0].status }
  },
  async analyzeDownloadStrategy({ url, requested_route }) {
    return { ok: true, analysis: { url, route: requested_route ?? 'auto', primary: 'yt-dlp' as const, fallback: null, reason: '仅为模拟策略字段；未接入下载器、网络或浏览器能力，不代表站点支持。', ytdlp_scope: { supported_sites_source: 'yt-dlp supportedsites.md' as const, supports_generic_extractor: false, supports_embeds: false, reliable_check: 'try-extractor' as const, media: [] } } }
  },
  async getActiveTasks(signal) { signal?.throwIfAborted(); return { ok: true, tasks: structuredClone(state.tasks.filter(t => !['completed', 'failed', 'cancelled'].includes(t.status))) } },
  async getWeeklyHistory(signal) { signal?.throwIfAborted(); return { ok: true, tasks: structuredClone(state.tasks) } },
  async cancelTask(id) { guard(); const changed = transition(id, 'canceled'); return { ok: changed, message: changed ? '模拟任务已取消。' : '任务已经终止，取消未生效。' } },
  async deleteTaskRecord(id) {
    guard(); const task = state.tasks.find(t => t.task_id === id)
    if (!task) throw new Error('模拟下载记录不存在。')
    if (!['completed', 'failed', 'cancelled'].includes(task.status)) throw new Error('请先取消活动模拟任务，再删除记录。')
    state.tasks = state.tasks.filter(t => t.task_id !== id); state.jobs = state.jobs.filter(j => j.id !== id); return { ok: true }
  },
  async clearTaskRecords(ids) {
    guard(); const selected = state.tasks.filter(t => !ids?.length || ids.includes(t.task_id))
    if (selected.some(t => !['completed', 'failed', 'cancelled'].includes(t.status))) throw new Error('存在活动模拟任务，请先取消。')
    const removed = new Set(selected.map(t => t.task_id)); state.tasks = state.tasks.filter(t => !removed.has(t.task_id)); state.jobs = state.jobs.filter(j => !removed.has(j.id)); return { ok: true }
  },
  getFetchTaskFileUrl(): string { throw new Error('模拟任务没有真实输出文件，无法下载。') },
  async listJobs(signal) { signal?.throwIfAborted(); return { ok: true, jobs: structuredClone(state.jobs) } },
  async getJob(id, signal) { signal?.throwIfAborted(); const job = state.jobs.find(j => j.id === id); return { ok: Boolean(job), job: job ? structuredClone(job) : undefined } },
  async fetchAssets() { return { ok: true, assets: getDemoSnapshot().assets } },
  async submitTranscodeJob(draft) { return createJob('media.transcode', `模拟转码 · ${draft.title?.trim() || '内置素材'} · 无真实输出`) },
  async cancelJob(id) { guard(); const changed = transition(id, 'canceled'); return { ok: changed, message: changed ? '模拟任务已取消。' : '任务已经终止，取消未生效。' } },
  async probeTranscodeSource() { guard(); return { ok: true, source: { videoCodec: 'h264', audioCodec: 'aac', width: 1920, height: 1080, fps: '30', bitrateKbps: 12_000, durationSeconds: 86, isAlreadyHevc: false, suggestRemux: false, recommendedPreset: 'mp4-h265-aac', recommendedCrf: 20, recommendedEncodePreset: 'slow', recommendedAudioBitrate: 192, notes: ['固定模拟 metadata；没有探测真实文件，不代表格式支持。'] } } },
  async previewTranscodeCommand() { return { ok: true, args: ['模拟规划：未生成或执行真实转码命令。'] } },
  async scanPsd() { const job = createJob('psd.scan', '模拟 PSD 扫描'); return { ok: true, job, workOrderId: state.workOrder.id, message: '内置模拟工单；请推进场景查看终态。' } },
  async getWorkOrder(id) { return { ok: id === state.workOrder.id, workOrder: id === state.workOrder.id ? structuredClone(state.workOrder) : undefined } },
  async updateWorkOrder(next) { guard(); if (next.id !== state.workOrder.id) throw new Error('模拟工单不存在。'); state.workOrder = structuredClone({ ...next, executionSource: 'mock', updatedAt: now() }); return { ok: true } },
  async applyWorkOrder(id) { if (id !== state.workOrder.id) throw new Error('模拟工单不存在。'); const job = createJob('psd.apply', '模拟 PSD 应用 · 无真实输出'); return { ok: true, job, message: '仅模拟工单状态，不调用 Photoshop 或生成文件。' } },
  async listSystemFonts() { return { ok: true, fonts: [{ postScriptName: 'NotoSans-Regular', family: 'Noto Sans（模拟）', style: 'Regular' }, { postScriptName: 'Inter-Regular', family: 'Inter（模拟）', style: 'Regular' }] } },
  async getWorkspace() { return { ok: true, project_root: '/Workspace', workspace: { project_root: '/Workspace', downloads: '/Workspace/Downloads', exports: '/Workspace/Exports' } } },
  async fetchFilebrowserDisks() { return { ok: true, disks: [{ name: '模拟工作区（非真实磁盘）', path: '/Workspace', root: '/Workspace', total: 1_000_000_000_000, used: 448_000_000_000, free: 552_000_000_000, browsable: true }] } },
  listFilebrowserDirectory: filesystem.listFilebrowserDirectory,
  createFilebrowserDirectory: filesystem.createFilebrowserDirectory,
  deleteFilebrowserPath: filesystem.deleteFilebrowserPath,
  fetchFilebrowserTrash: filesystem.fetchFilebrowserTrash,
  restoreFilebrowserTrash: filesystem.restoreFilebrowserTrash,
  purgeFilebrowserTrash: filesystem.purgeFilebrowserTrash,
  emptyFilebrowserTrash: filesystem.emptyFilebrowserTrash,
  uploadFilebrowserFile: filesystem.uploadFilebrowserFile,
  filebrowserFileDownloadUrl: filesystem.filebrowserFileDownloadUrl,
  async setWorkspace(workspace) { if (workspace !== '/Workspace') throw new Error('Demo 仅包含 /Workspace 模拟目录，不切换真实磁盘。'); return { ok: true, workspace } },
  async getSystemMetrics() {
    const active = state.jobs.filter((job) => job.status === 'running')
    return { runtime: { uptime_seconds: Math.floor(state.step) }, system: { cpu_percent: 24, memory_percent: 42, memory_pressure_percent: 42, memory_pressure_label: '物理占用', memory_used_bytes: 6_800_000_000, memory_total_bytes: 16_000_000_000, memory_free_bytes: 9_200_000_000, gpu_percent: 18, gpu_available: true, gpu_detail: '演示 GPU 数据' }, network: { upload: { text: '1.2 MB/s' }, download: { text: '8.4 MB/s' }, upload_bytes_per_sec: 1_200_000, download_bytes_per_sec: 8_400_000 }, services: [{ id: 'demo-ui', name: '独立前端', online: true, status: '演示中', runtime_status: 'demo', availability_status: 'available', mode: 'demo', mode_label: '演示数据', detail: '无后端连接' }], tasks: active.map((job) => ({ id: job.id, name: job.title, type: job.kind, status: job.status, status_label: '演示中', stage: '浏览器内置数据', progress: job.progress?.current ?? 0, can_cancel: true })), task_summary: { active_downloads: state.tasks.filter((task) => task.status === 'running').length, total_download_records: state.tasks.length, terminal_download_records: state.tasks.filter((task) => task.status === 'completed').length }, log_mode: 'demo' }
  },
  async fetchSystemRuntimeMetrics() { return { runtime: { uptime_seconds: Math.floor(state.step) }, network: { upload: { text: '1.2 MB/s' }, download: { text: '8.4 MB/s' }, upload_bytes_per_sec: 1_200_000, download_bytes_per_sec: 8_400_000 } } },
  async shutdownSystem() { return { ok: false, message: '独立演示版没有可关闭的服务。' } },

  async fetchLogs(query) { const filtered = state.logs.filter((entry) => (!query?.level || entry.level === query.level) && (!query?.module || entry.module === query.module)); return { ok: true, total: filtered.length, items: filtered, page: query?.page ?? 1, page_size: query?.page_size ?? 20, levels: ['DEBUG', 'NOTICE', 'WARNING', 'ERROR', 'CRITICAL'] } },
  async fetchLogMetadata() { return { ok: true, modules: ['demo'] } },
  async clearLogs() { state.logs = []; return { ok: true } },
  async getUnreadNotificationCount() { return { ok: true, unread_count: state.logs.filter((entry) => entry.level === 'WARNING' || entry.level === 'ERROR').length } },
  async fetchNotifications(query) { const items = state.logs.filter((entry) => entry.level === 'WARNING' || entry.level === 'ERROR'); return { ok: true, total: items.length, items, page: query?.page ?? 1, page_size: query?.page_size ?? 20, levels: ['WARNING', 'ERROR', 'CRITICAL'] } },
  async clearNotifications() { state.logs = state.logs.filter((entry) => entry.level !== 'WARNING' && entry.level !== 'ERROR'); return { ok: true } },
  async markAllNotificationsAsRead() { return { ok: true } },
} satisfies UnasDemoApi

const mutations = new Set<keyof UnasDemoApi>([
  'submitFetch', 'cancelTask', 'deleteTaskRecord', 'clearTaskRecords', 'submitTranscodeJob', 'cancelJob',
  'scanPsd', 'updateWorkOrder', 'applyWorkOrder', 'submitDemoTool', 'createFilebrowserDirectory',
  'deleteFilebrowserPath', 'restoreFilebrowserTrash', 'purgeFilebrowserTrash', 'emptyFilebrowserTrash',
  'uploadFilebrowserFile', 'clearLogs', 'clearNotifications', 'markAllNotificationsAsRead',
])
export const demoApi: UnasDemoApi = Object.fromEntries(Object.entries(implementation).map(([key, method]) => {
  return [key, (...args: unknown[]) => {
    const result = (method as (...values: unknown[]) => unknown)(...args)
    if (!(result instanceof Promise)) return result
    return result.then(value => {
      if (mutations.has(key as keyof UnasDemoApi)) publish()
      return value && typeof value === 'object' ? { ...structuredClone(value), executionSource: 'mock' } : value
    })
  }]
})) as unknown as UnasDemoApi
