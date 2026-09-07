import type { DemoSnapshot } from 'unas-src/api'

export const WORKSPACE_CHANNEL = 'unas-workspace-session-v2'
export const MAX_MESSAGE_BYTES = 200_000
const string = (v: unknown) => typeof v === 'string' && v.length <= 4096
const optionalString = (v: unknown) => v === undefined || string(v)
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 200 && v.every(string)
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const noArgs = (args: unknown[]) => args.length === 0
const oneString = (args: unknown[]) => args.length === 1 && string(args[0])
const query = (v: unknown) => v === undefined || object(v) && Object.entries(v).every(([key, value]) =>
  ['level', 'module'].includes(key) ? string(value) : ['page', 'page_size'].includes(key) ? Number.isInteger(value) && Number(value) > 0 && Number(value) <= 1000 : key === 'unread_only' && typeof value === 'boolean')

// Only the bundled Files/Downloader UI and read-only shell API cross this channel.
const methods: Record<string, (args: unknown[]) => boolean> = {
  getActiveTasks: noArgs, getWeeklyHistory: noArgs, listJobs: noArgs, fetchAssets: noArgs,
  getWorkspace: noArgs, fetchFilebrowserDisks: noArgs, fetchFilebrowserTrash: noArgs,
  emptyFilebrowserTrash: noArgs, getSystemMetrics: noArgs, fetchSystemRuntimeMetrics: noArgs,
  getUnreadNotificationCount: noArgs, fetchLogMetadata: noArgs, clearLogs: noArgs,
  clearNotifications: noArgs, markAllNotificationsAsRead: noArgs,
  cancelTask: oneString, cancelJob: oneString, deleteTaskRecord: oneString, getJob: oneString,
  createFilebrowserDirectory: oneString, restoreFilebrowserTrash: oneString, purgeFilebrowserTrash: oneString,
  listFilebrowserDirectory: args => args.length === 1 && object(args[0]) && Object.keys(args[0]).join() === 'directory' && string(args[0].directory),
  deleteFilebrowserPath: args => args.length >= 1 && args.length <= 2 && string(args[0]) && (args[1] === undefined || typeof args[1] === 'boolean'),
  clearTaskRecords: args => args.length <= 1 && (args[0] === undefined || strings(args[0])),
  uploadFilebrowserFile: args => args.length === 2 && string(args[0]) && object(args[1]) &&
    Object.keys(args[1]).sort().join() === 'executionSource,fixtureId' && args[1].executionSource === 'mock' && ['sample-image', 'sample-document', 'sample-video'].includes(String(args[1].fixtureId)),
  submitFetch: args => args.length === 1 && object(args[0]) && Object.entries(args[0]).every(([key, value]) => {
    if (['url', 'output_dir', 'cookies_from_browser'].includes(key)) return optionalString(value)
    if (key === 'urls') return strings(value) && value.length <= 20
    if (key === 'mode') return value === 'video' || value === 'audio'
    if (key === 'compatible_format') return typeof value === 'boolean'
    return key === 'max_concurrent' && Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 20
  }),
  fetchLogs: args => args.length <= 1 && query(args[0]),
  fetchNotifications: args => args.length <= 1 && query(args[0]),
}

export function validCall(method: unknown, args: unknown): method is string {
  return typeof method === 'string' && Object.prototype.hasOwnProperty.call(methods, method) && Array.isArray(args) && methods[method](args)
}

export type SessionMessage = {
  version: 2; type: 'hello' | 'snapshot' | 'call' | 'result' | 'closed'
  sender: string; target?: string; owner: string; id?: string
  method?: string; args?: unknown[]; snapshot?: DemoSnapshot; value?: unknown; error?: string
}
export function validSnapshot(value: unknown): value is DemoSnapshot {
  if (!object(value) || value.executionSource !== 'mock' || typeof value.scenarioId !== 'string' || typeof value.hasPendingUserTasks !== 'boolean') return false
  if (!Number.isInteger(value.revision) || !Number.isInteger(value.step)) return false
  if (!['jobs', 'tasks', 'assets'].every(key => Array.isArray(value[key]) && value[key].length <= 1000 && value[key].every(object))) return false
  const jobs = value.jobs as Record<string, unknown>[]
  const tasks = value.tasks as Record<string, unknown>[]
  const assets = value.assets as Record<string, unknown>[]
  return jobs.every(job => job.executionSource === 'mock' && string(job.id) && string(job.title) && ['running', 'queued', 'paused', 'succeeded', 'failed', 'canceled'].includes(String(job.status))) &&
    tasks.every(task => task.executionSource === 'mock' && string(task.id) && string(task.task_id) && ['running', 'pending', 'paused', 'completed', 'failed', 'cancelled'].includes(String(task.status))) &&
    assets.every(asset => asset.executionSource === 'mock' && string(asset.id) && string(asset.path) && string(asset.name))
}
export function validMessage(value: unknown): value is SessionMessage {
  if (!object(value) || value.version !== 2 || !['hello', 'snapshot', 'call', 'result', 'closed'].includes(String(value.type))) return false
  if (!string(value.sender) || !value.sender || !string(value.owner) || !optionalString(value.target) || !optionalString(value.id)) return false
  if (value.type !== 'hello' && !value.owner) return false
  if (Object.keys(value).some(key => !['version', 'type', 'sender', 'target', 'owner', 'id', 'method', 'args', 'snapshot', 'value', 'error'].includes(key))) return false
  try { if (JSON.stringify(value).length > MAX_MESSAGE_BYTES) return false } catch { return false }
  if (value.type === 'snapshot') return validSnapshot(value.snapshot)
  if (value.type === 'call') return typeof value.id === 'string' && validCall(value.method, value.args)
  if (value.type === 'result') return typeof value.id === 'string' && optionalString(value.error)
  return true
}
