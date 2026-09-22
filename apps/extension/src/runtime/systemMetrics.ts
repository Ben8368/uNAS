import type { RuntimeMetrics } from '#contracts'

import { extensionApi } from './extensionPlatform'

type CpuTime = { idle?: number; total?: number; user?: number; kernel?: number }
type CpuInfo = { processors?: Array<{ usage?: CpuTime }> }
type MemoryInfo = { capacity?: number; availableCapacity?: number }
type SystemApi = {
  cpu?: { getInfo?: () => Promise<CpuInfo> }
  memory?: { getInfo?: () => Promise<MemoryInfo> }
}
type GpuAdapter = { info?: { vendor?: string; architecture?: string; device?: string } }
type NetworkInformation = { effectiveType?: string; downlink?: number; rtt?: number }
type RuntimeNavigator = Navigator & { connection?: NetworkInformation; gpu?: { requestAdapter?: () => Promise<GpuAdapter | null> } }
type RuntimePerformance = Performance & { memory?: { usedJSHeapSize?: number; jsHeapSizeLimit?: number } }
type CpuSample = { cpu_percent?: number; uptime_seconds?: number }
type CpuBaseline = { total: number; idle: number; counter_total: number; sampled_at: number }

let previousCpu: CpuBaseline | null = null
let cpuCounterScale: number | undefined
let gpuProbe: Promise<Pick<NonNullable<RuntimeMetrics['system']>, 'gpu_available' | 'gpu_detail'>> | null = null

// Chrome documents CpuTime in milliseconds, but some Chromium/Windows builds
// expose a different scale. Calibrate against wall-clock time instead of
// trusting a platform-specific unit.
const cpuCounterScales = [1, 10, 100, 1_000, 10_000, 100_000, 1_000_000]

function abortIfNeeded(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('指标读取已取消。', 'AbortError')
}

function percent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10))
}

function inferCpuCounterScale(rawDelta: number, elapsedMs: number) {
  if (!Number.isFinite(rawDelta) || !Number.isFinite(elapsedMs) || rawDelta <= 0 || elapsedMs < 500 || elapsedMs > 10_000) return undefined
  const rawUnitsPerMs = rawDelta / elapsedMs
  if (rawUnitsPerMs < 0.25) return undefined
  return cpuCounterScales.reduce((closest, scale) => Math.abs(Math.log(rawUnitsPerMs / scale)) < Math.abs(Math.log(rawUnitsPerMs / closest)) ? scale : closest)
}

async function readCpu(signal?: AbortSignal): Promise<CpuSample | undefined> {
  const system = (extensionApi() as (ReturnType<typeof extensionApi> & { system?: SystemApi }) | undefined)?.system
  const getInfo = system?.cpu?.getInfo
  if (!getInfo) return undefined
  try {
    const info = await getInfo()
    abortIfNeeded(signal)
    const usages = (info.processors || [])
      .map((processor) => processor.usage)
      .filter((usage): usage is CpuTime => usage != null && Number.isFinite(usage.total) && Number.isFinite(usage.idle))
    if (!usages.length) return undefined
    let total = 0
    let idle = 0
    for (const usage of usages) {
      total += usage.total || 0
      idle += usage.idle || 0
    }
    if (total <= 0) return undefined
    const counterTotal = Math.max(0, usages[0].total || 0)
    const current: CpuBaseline = { total, idle, counter_total: counterTotal, sampled_at: Date.now() }
    const baseline = previousCpu
    previousCpu = current
    if (baseline) {
      cpuCounterScale = inferCpuCounterScale(counterTotal - baseline.counter_total, current.sampled_at - baseline.sampled_at) || cpuCounterScale
    }
    const uptimeSeconds = cpuCounterScale ? Math.floor(counterTotal / cpuCounterScale / 1000) : undefined
    if (!baseline) return { uptime_seconds: uptimeSeconds }
    const totalDelta = current.total - baseline.total
    const idleDelta = current.idle - baseline.idle
    if (totalDelta <= 0) return { uptime_seconds: uptimeSeconds }
    return { cpu_percent: percent((1 - Math.max(0, idleDelta) / totalDelta) * 100), uptime_seconds: uptimeSeconds }
  } catch {
    return undefined
  }
}

async function readMemory(signal?: AbortSignal) {
  const system = (extensionApi() as (ReturnType<typeof extensionApi> & { system?: SystemApi }) | undefined)?.system
  const getInfo = system?.memory?.getInfo
  if (getInfo) {
    try {
      const info = await getInfo()
      abortIfNeeded(signal)
      const total = Number(info.capacity || 0)
      const available = Number(info.availableCapacity || 0)
      if (total > 0 && available >= 0) {
        const used = Math.max(0, total - available)
        return { memory_percent: percent((used / total) * 100), memory_pressure_percent: percent((used / total) * 100), memory_pressure_label: '物理占用', memory_used_bytes: used, memory_total_bytes: total, memory_free_bytes: available }
      }
    } catch {
      // Fall through to the page-level heap metric when the permission/API is unavailable.
    }
  }
  const memory = (globalThis.performance as RuntimePerformance | undefined)?.memory
  const used = Number(memory?.usedJSHeapSize || 0)
  const total = Number(memory?.jsHeapSizeLimit || 0)
  if (used > 0 && total > 0) return { memory_percent: percent((used / total) * 100), memory_pressure_percent: percent((used / total) * 100), memory_pressure_label: 'JS 堆', memory_used_bytes: used, memory_total_bytes: total, memory_free_bytes: Math.max(0, total - used) }
  return {}
}

async function readGpu(signal?: AbortSignal) {
  if (!gpuProbe) {
    const gpu = (globalThis.navigator as RuntimeNavigator | undefined)?.gpu
    gpuProbe = (async () => {
      if (!gpu?.requestAdapter) return { gpu_available: false, gpu_detail: '浏览器未提供 WebGPU；无法读取 GPU 利用率或显存。' }
      try {
        const adapter = await gpu.requestAdapter()
        if (!adapter) return { gpu_available: false, gpu_detail: '未检测到可用 GPU；无法读取 GPU 利用率或显存。' }
        const info = adapter.info || {}
        const device = [info.vendor, info.architecture, info.device].filter(Boolean).join(' / ')
        return { gpu_available: true, gpu_detail: device ? `已检测到 GPU（${device}）；浏览器未开放利用率或显存读数。` : '已检测到 GPU；浏览器未开放利用率或显存读数。' }
      } catch {
        return { gpu_available: false, gpu_detail: 'GPU 能力探测失败；无法读取 GPU 利用率或显存。' }
      }
    })()
  }
  const result = await gpuProbe
  abortIfNeeded(signal)
  return result
}

function readNetwork() {
  const runtimeNavigator = globalThis.navigator as RuntimeNavigator | undefined
  const connection = runtimeNavigator?.connection
  const online = runtimeNavigator?.onLine ?? false
  const downlinkMbps = Number(connection?.downlink)
  const downlinkBytesPerSecond = Number.isFinite(downlinkMbps) && downlinkMbps >= 0 ? downlinkMbps * 1_000_000 / 8 : undefined
  const connectionLabel = connection?.effectiveType?.toUpperCase() || '未知网络'
  const detail = online ? [connectionLabel, Number.isFinite(connection?.rtt) && connection?.rtt ? `RTT ${connection.rtt} ms` : 'RTT 未知'].join(' · ') : '离线'
  return {
    online, status: online ? '在线' : '离线', detail, effective_type: connection?.effectiveType,
    rtt_ms: Number.isFinite(connection?.rtt) ? connection?.rtt : undefined,
    downlink_mbps: Number.isFinite(downlinkMbps) ? downlinkMbps : undefined,
    upload: { text: '不可用' },
    download: { text: downlinkMbps >= 0 && Number.isFinite(downlinkMbps) ? `约 ${downlinkMbps} Mbps` : '不可用' },
    upload_bytes_per_sec: undefined, download_bytes_per_sec: downlinkBytesPerSecond,
  }
}

export async function readBrowserSystemMetrics(signal?: AbortSignal): Promise<Pick<RuntimeMetrics, 'runtime' | 'system' | 'network'> & { executionSource: 'browser' }> {
  abortIfNeeded(signal)
  const [cpu, memory, gpu] = await Promise.all([readCpu(signal), readMemory(signal), readGpu(signal)])
  abortIfNeeded(signal)
  return { executionSource: 'browser', runtime: cpu?.uptime_seconds == null ? undefined : { uptime_seconds: cpu.uptime_seconds }, system: { ...memory, cpu_percent: cpu?.cpu_percent, ...gpu, gpu_percent: undefined }, network: readNetwork() }
}
