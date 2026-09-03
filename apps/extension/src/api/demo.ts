import type {
  AssetRecord,
  FetchTaskDraft,
  FetchTaskRecord,
  FileEntry,
  JobRecord,
  LogEntry,
  TextLayerRecord,
  WorkOrder,
} from '#contracts'

import type { UnasDemoApi, TranscodeJobDraft } from './types'

const startedAt = Date.now()
const isoNow = () => new Date().toISOString()
const unixNow = () => Math.floor(Date.now() / 1000)
const demoId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

let tasks: FetchTaskRecord[] = [
  {
    id: 'demo-download-1', task_id: 'demo-download-1', title: '产品发布会回放', source_url: 'https://example.com/product-launch',
    status: 'running', progress: 68, stage: '正在下载视频流', created_at: unixNow() - 320, updated_at: unixNow(), started_at: unixNow() - 300, completed_at: null,
    params: { mode: 'video' }, output_files: [], error: null,
  },
  {
    id: 'demo-download-2', task_id: 'demo-download-2', title: '品牌素材音轨', source_url: 'https://example.com/audio',
    status: 'completed', progress: 100, stage: '完成', created_at: unixNow() - 7200, updated_at: unixNow() - 6800, started_at: unixNow() - 7150, completed_at: unixNow() - 6800,
    params: { mode: 'audio' }, output_files: ['/Workspace/Downloads/brand-track.mp3'], error: null,
  },
]

let jobs: JobRecord[] = [
  makeJob('media.transcode', '品牌片 · H.265 1080p', 'succeeded', 100),
  makeJob('download.video', '产品发布会回放', 'running', 68),
]

let assets: AssetRecord[] = [
  { id: 'asset-1', kind: 'video', name: 'brand-film-h265.mp4', path: '/Workspace/Exports/brand-film-h265.mp4', size: 84_200_000, mimeType: 'video/mp4', createdAt: isoNow(), updatedAt: isoNow() },
  { id: 'asset-2', kind: 'audio', name: 'brand-track.mp3', path: '/Workspace/Downloads/brand-track.mp3', size: 7_600_000, mimeType: 'audio/mpeg', createdAt: isoNow(), updatedAt: isoNow() },
  { id: 'asset-3', kind: 'image', name: 'lumora-cover.png', path: '/Workspace/Images/lumora-cover.png', size: 1_240_000, mimeType: 'image/png', createdAt: isoNow(), updatedAt: isoNow() },
]

let logs: LogEntry[] = [
  { level: 'NOTICE', module: 'demo', time: new Date().toLocaleString('zh-CN'), user: '演示用户', event: '独立前端演示已启动', message: '未连接 API、worker 或桌面服务。' },
  { level: 'WARNING', module: 'demo', time: new Date(Date.now() - 240_000).toLocaleString('zh-CN'), user: 'system', event: '示例通知', message: '这是用于演示通知中心的本地样例。' },
]

let workOrder = createWorkOrder()

function makeJob(kind: JobRecord['kind'], title: string, status: JobRecord['status'], progress: number): JobRecord {
  const now = unixNow()
  return {
    id: demoId('job'), kind, title, status, attempt: 1, maxAttempts: 1, outputToken: demoId('output'),
    progress: { current: progress, total: 100, unit: 'percent' }, createdAt: now, updatedAt: now,
  }
}

function createWorkOrder(): WorkOrder {
  const record = (id: string, layerId: number, layerPath: string, text: string): TextLayerRecord => ({
    id, layerId, layerPath, soChain: [], enabled: true, originalText: text, originalFontFamily: 'Noto Sans', originalFontStyle: 'Regular', originalFontPs: 'NotoSans-Regular',
    originalSizePt: 28, originalLeadingPt: 34, originalTrackingValue: 0, boundsHPx: 80, boundsWPx: 480, fakesBold: false,
  })
  const now = unixNow()
  return {
    id: 'demo-work-order', psdPath: '/Workspace/PSD/brand-key-visual.psd', psdFileName: 'brand-key-visual.psd', documentWidth: 1920, documentHeight: 1080, documentResolution: 72,
    createdAt: now, updatedAt: now, records: [record('layer-title', 3, 'Hero/Title', '更清晰的品牌表达'), record('layer-caption', 8, 'Hero/Caption', 'Build once. Present anywhere.')],
  }
}

const directoryEntries: Record<string, { directories: FileEntry[]; files: FileEntry[] }> = {
  '/Workspace': {
    directories: [directory('Downloads'), directory('Exports'), directory('Images'), directory('PSD')],
    files: [file('README-demo.txt', 1200, 'txt')],
  },
  '/Workspace/Downloads': { directories: [], files: [file('brand-track.mp3', 7_600_000, 'mp3'), file('product-launch.mp4', 152_000_000, 'mp4')] },
  '/Workspace/Exports': { directories: [], files: [file('brand-film-h265.mp4', 84_200_000, 'mp4'), file('web-composer-cover.png', 1_240_000, 'png')] },
  '/Workspace/Images': { directories: [], files: [file('lumora-cover.png', 1_240_000, 'png'), file('logo-white.svg', 3_200, 'svg')] },
  '/Workspace/PSD': { directories: [], files: [file('brand-key-visual.psd', 24_300_000, 'psd')] },
}

function directory(name: string): FileEntry {
  return { name, path: `/Workspace/${name}`, size: 0, modified: isoNow(), type: 'directory' }
}

function file(name: string, size: number, extension: string): FileEntry {
  return { name, path: `/Workspace/${name}`, size, modified: isoNow(), type: 'file', extension }
}

function log(level: string, event: string, message: string): void {
  logs = [{ level, module: 'demo', time: new Date().toLocaleString('zh-CN'), user: '演示用户', event, message }, ...logs]
}

function updateJob(id: string, status: JobRecord['status']): void {
  jobs = jobs.map((job) => job.id === id ? { ...job, status, updatedAt: unixNow(), progress: { current: status === 'canceled' ? 0 : 100, total: 100, unit: 'percent' } } : job)
}

export const demoApi = {
  async submitFetch(draft: FetchTaskDraft) {
    const urls = draft.urls?.filter(Boolean) ?? (draft.url ? [draft.url] : [])
    const newTasks = urls.map((url) => {
      const id = demoId('download')
      const next: FetchTaskRecord = { id, task_id: id, title: `演示下载 · ${new URL(url, 'https://example.com').hostname}`, source_url: url, status: 'running', progress: 12, stage: '等待下载', created_at: unixNow(), updated_at: unixNow(), started_at: unixNow(), completed_at: null, params: { mode: draft.mode ?? 'video' }, output_files: [], error: null }
      jobs = [makeJob(draft.mode === 'audio' ? 'download.audio' : 'download.video', next.title, 'running', 12), ...jobs]
      return next
    })
    tasks = [...newTasks, ...tasks]
    log('NOTICE', '创建演示下载任务', `已在浏览器内创建 ${newTasks.length} 个演示任务。`)
    return { ok: true, task_id: newTasks[0]?.task_id, task_ids: newTasks.map((task) => task.task_id), status: 'running' as const }
  },
  async analyzeDownloadStrategy({ url, requested_route }) {
    return { ok: true, analysis: { url, route: requested_route ?? 'auto', primary: 'yt-dlp' as const, fallback: 'browser-network' as const, reason: '演示版仅显示下载策略，不会发起网络请求。', ytdlp_scope: { supported_sites_source: 'yt-dlp supportedsites.md' as const, supports_generic_extractor: true, supports_embeds: true, reliable_check: 'try-extractor' as const, media: ['video', 'audio', 'subtitles', 'playlists', 'livestreams', 'metadata'] } } }
  },
  async getActiveTasks() { return { ok: true, tasks: tasks.filter((task) => !['completed', 'failed', 'cancelled'].includes(task.status)) } },
  async getWeeklyHistory() { return { ok: true, tasks } },
  async cancelTask(taskId: string) { tasks = tasks.map((task) => task.task_id === taskId ? { ...task, status: 'cancelled', stage: '已取消', updated_at: unixNow() } : task); log('NOTICE', '取消演示下载', taskId); return { ok: true } },
  async deleteTaskRecord(taskId: string) { tasks = tasks.filter((task) => task.task_id !== taskId); return { ok: true } },
  async clearTaskRecords(taskIds) { tasks = taskIds?.length ? tasks.filter((task) => !taskIds.includes(task.task_id)) : []; return { ok: true } },
  getFetchTaskFileUrl() { return '/static/web-composer/lumora-train-overlay.png' },

  async listJobs() { return { ok: true, jobs } },
  async getJob(jobId: string) { const job = jobs.find((item) => item.id === jobId); return { ok: Boolean(job), job } },
  async fetchAssets() { return { ok: true, assets } },
  async submitTranscodeJob(draft: TranscodeJobDraft) {
    const title = draft.title?.trim() || `演示转码 · ${(draft.inputPath || 'source').split('/').pop()}`
    const job = makeJob('media.transcode', title, 'succeeded', 100)
    jobs = [job, ...jobs]
    if (draft.outputPath) assets = [{ id: demoId('asset'), kind: 'video', name: draft.outputPath.split('/').pop() || 'output.mp4', path: draft.outputPath, size: 48_500_000, mimeType: 'video/mp4', createdAt: isoNow(), updatedAt: isoNow() }, ...assets]
    log('NOTICE', '完成演示转码', title)
    return job
  },
  async cancelJob(jobId: string) { updateJob(jobId, 'canceled'); log('NOTICE', '取消演示任务', jobId); return { ok: true } },
  async probeTranscodeSource() { return { ok: true, source: { videoCodec: 'h264', audioCodec: 'aac', width: 1920, height: 1080, fps: '30', bitrateKbps: 12_000, durationSeconds: 86, isAlreadyHevc: false, suggestRemux: false, recommendedPreset: 'mp4-h265-aac', recommendedCrf: 20, recommendedEncodePreset: 'slow', recommendedAudioBitrate: 192, notes: ['样例素材：1080p，建议使用 H.265 预设。'] } } },
  async previewTranscodeCommand(draft) { return { ok: true, args: ['ffmpeg', '-i', draft.inputPath || 'source.mov', '-c:v', draft.preset === 'mp4-h265-aac' ? 'libx265' : 'libx264', '-crf', String(draft.videoCrf ?? 20), draft.outputPath || 'output.mp4'] } },
  async scanPsd() { const job = makeJob('psd.scan', '演示 PSD 扫描', 'succeeded', 100); jobs = [job, ...jobs]; workOrder = createWorkOrder(); return { ok: true, job, workOrderId: workOrder.id, message: '已载入内置演示 PSD 工单。' } },
  async getWorkOrder(workOrderId: string) { return { ok: workOrderId === workOrder.id, workOrder: workOrderId === workOrder.id ? workOrder : undefined } },
  async updateWorkOrder(next: WorkOrder) { workOrder = { ...next, updatedAt: unixNow() }; log('NOTICE', '保存演示 PSD 工单', next.psdFileName); return { ok: true } },
  async applyWorkOrder() { const job = makeJob('psd.apply', '演示 PSD 应用', 'succeeded', 100); jobs = [job, ...jobs]; log('NOTICE', '完成演示 PSD 输出', '未调用 Photoshop。'); return { ok: true, job, message: '演示工单已完成；未调用 Photoshop。' } },
  async submitWebComposerPng() { const job = makeJob('web.render.image', '网页合成演示 PNG', 'succeeded', 100); jobs = [job, ...jobs]; return job },
  async submitWebComposerVideo() { const job = makeJob('web.render.video', '网页合成演示视频', 'succeeded', 100); jobs = [job, ...jobs]; return job },

  async listSystemFonts() { return { ok: true, fonts: [{ postScriptName: 'NotoSans-Regular', family: 'Noto Sans', style: 'Regular' }, { postScriptName: 'Inter-Regular', family: 'Inter', style: 'Regular' }, { postScriptName: 'HelveticaNeue-Bold', family: 'Helvetica Neue', style: 'Bold' }] } },

  async getWorkspace() { return { ok: true, project_root: '/Workspace', workspace: { project_root: '/Workspace', downloads: '/Workspace/Downloads', exports: '/Workspace/Exports' } } },
  async fetchFilebrowserDisks() { return { ok: true, disks: [{ name: '演示工作区', path: '/Workspace', root: '/Workspace', total: 1_000_000_000_000, used: 448_000_000_000, free: 552_000_000_000, browsable: true }] } },
  async listFilebrowserDirectory({ directory }) { const item = directoryEntries[directory] ?? { directories: [], files: [] }; return { ok: true, path: directory, ...item } },
  async createFilebrowserDirectory(path: string) { const name = path.split('/').pop() || '新建文件夹'; const parent = path.split('/').slice(0, -1).join('/') || '/Workspace'; directoryEntries[parent] ??= { directories: [], files: [] }; directoryEntries[parent].directories.push({ name, path, size: 0, modified: isoNow(), type: 'directory' }); return { ok: true, path } },
  async deleteFilebrowserPath(path: string) { Object.values(directoryEntries).forEach((entry) => { entry.files = entry.files.filter((file) => file.path !== path); entry.directories = entry.directories.filter((directory) => directory.path !== path) }); return { ok: true } },
  async fetchFilebrowserTrash() { return { ok: true, items: [] } },
  async restoreFilebrowserTrash() { return { ok: true } },
  async purgeFilebrowserTrash() { return { ok: true } },
  async emptyFilebrowserTrash() { return { ok: true } },
  async setWorkspace(workspace: string) { return { ok: true, workspace } },
  async uploadFilebrowserFile(directory: string, upload: File) { const path = `${directory}/${upload.name}`; directoryEntries[directory] ??= { directories: [], files: [] }; directoryEntries[directory].files.push({ name: upload.name, path, size: upload.size, modified: isoNow(), type: 'file', extension: upload.name.split('.').pop() }); return { ok: true, path, name: upload.name } },
  filebrowserFileDownloadUrl() { return '/static/web-composer/lumora-train-overlay.png' },

  async getSystemMetrics() {
    const active = jobs.filter((job) => job.status === 'running')
    return { runtime: { uptime_seconds: Math.floor((Date.now() - startedAt) / 1000) }, system: { cpu_percent: 24, memory_percent: 42, memory_pressure_percent: 42, memory_pressure_label: '物理占用', memory_used_bytes: 6_800_000_000, memory_total_bytes: 16_000_000_000, memory_free_bytes: 9_200_000_000, gpu_percent: 18, gpu_available: true, gpu_detail: '演示 GPU 数据' }, network: { upload: { text: '1.2 MB/s' }, download: { text: '8.4 MB/s' }, upload_bytes_per_sec: 1_200_000, download_bytes_per_sec: 8_400_000 }, services: [{ id: 'demo-ui', name: '独立前端', online: true, status: '演示中', runtime_status: 'demo', availability_status: 'available', mode: 'demo', mode_label: '演示数据', detail: '无后端连接' }], tasks: active.map((job) => ({ id: job.id, name: job.title, type: job.kind, status: job.status, status_label: '演示中', stage: '浏览器内置数据', progress: job.progress?.current ?? 0, can_cancel: true })), task_summary: { active_downloads: tasks.filter((task) => task.status === 'running').length, total_download_records: tasks.length, terminal_download_records: tasks.filter((task) => task.status === 'completed').length }, log_mode: 'demo' }
  },
  async fetchSystemRuntimeMetrics() { return { runtime: { uptime_seconds: Math.floor((Date.now() - startedAt) / 1000) }, network: { upload: { text: '1.2 MB/s' }, download: { text: '8.4 MB/s' }, upload_bytes_per_sec: 1_200_000, download_bytes_per_sec: 8_400_000 } } },
  async shutdownSystem() { return { ok: false, message: '独立演示版没有可关闭的服务。' } },

  async fetchLogs(query) { const filtered = logs.filter((entry) => (!query?.level || entry.level === query.level) && (!query?.module || entry.module === query.module)); return { ok: true, total: filtered.length, items: filtered, page: query?.page ?? 1, page_size: query?.page_size ?? 20, levels: ['DEBUG', 'NOTICE', 'WARNING', 'ERROR', 'CRITICAL'] } },
  async fetchLogMetadata() { return { ok: true, modules: ['demo'] } },
  async clearLogs() { logs = []; return { ok: true } },
  async getUnreadNotificationCount() { return { ok: true, unread_count: logs.filter((entry) => entry.level === 'WARNING' || entry.level === 'ERROR').length } },
  async fetchNotifications(query) { const items = logs.filter((entry) => entry.level === 'WARNING' || entry.level === 'ERROR'); return { ok: true, total: items.length, items, page: query?.page ?? 1, page_size: query?.page_size ?? 20, levels: ['WARNING', 'ERROR', 'CRITICAL'] } },
  async clearNotifications() { logs = logs.filter((entry) => entry.level !== 'WARNING' && entry.level !== 'ERROR'); return { ok: true } },
  async markAllNotificationsAsRead() { return { ok: true } },
} satisfies UnasDemoApi
