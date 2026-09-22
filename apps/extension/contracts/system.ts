import type { OkResult } from './core.js'

export type RuntimeMetrics = {
  executionSource?: 'browser' | 'mock'
  runtime?: { uptime_seconds?: number }
  system?: {
    platform?: string
    cpu_percent?: number
    cpu_model?: string
    cpu_arch?: string
    cpu_cores?: number
    cpu_temperature_c?: number
    memory_percent?: number
    memory_pressure_percent?: number
    memory_pressure_label?: string
    memory_used_bytes?: number
    memory_total_bytes?: number
    memory_free_bytes?: number
    gpu_percent?: number
    gpu_available?: boolean
    gpu_model?: string
    storage_count?: number
    storage_capacity_bytes?: number
    storage_details?: Array<{
      capacity_bytes?: number
    }>
    display_count?: number
    display_details?: Array<{
      label: string
      is_primary: boolean
      resolution?: string
      refresh_rate_hz?: number
    }>
  }
  network?: {
    online?: boolean
    status?: string
    detail?: string
    effective_type?: string
    rtt_ms?: number
    downlink_mbps?: number
    upload?: { text?: string }
    download?: { text?: string }
    upload_bytes_per_sec?: number
    download_bytes_per_sec?: number
  }
  services?: Array<{
    id: string
    name: string
    online: boolean
    status: string
    runtime_status?: string
    availability_status?: string
    mode?: string
    mode_label?: string
    detail?: string
    dep?: string | null
    experimental?: boolean
  }>
  tasks?: Array<{
    id: string
    name: string
    source?: string
    type: string
    status: string
    status_label?: string
    stage: string
    progress: number
    can_pause?: boolean
    can_resume?: boolean
    can_cancel?: boolean
  }>
  task_summary?: {
    active_downloads?: number
    total_download_records?: number
    terminal_download_records?: number
  }
  log_mode?: string
}

export type RuntimeMetricsSlice = Pick<RuntimeMetrics, 'runtime' | 'network'>

export type LogEntry = {
  level: string
  module: string
  time: string
  user: string
  event: string
  message: string
}

export type LogListResponse = OkResult & {
  total: number
  items: LogEntry[]
  page: number
  page_size: number
  levels?: string[]
}

export type LogMetadataResponse = OkResult & {
  modules?: string[]
}

export type UnreadNotificationResponse = OkResult & {
  unread_count?: number
}
