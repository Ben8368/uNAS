import type { RuntimeMetrics } from '#contracts'

import { extensionApi } from './extensionPlatform'

type CpuTime = { idle?: number; total?: number; user?: number; kernel?: number }
type CpuInfo = {
  archName?: string
  modelName?: string
  numOfProcessors?: number
  processors?: Array<{ usage?: CpuTime }>
  temperatures?: number[]
}
type MemoryInfo = { capacity?: number; availableCapacity?: number }
type StorageInfo = {
  capacity?: number
  type?: 'fixed' | 'removable' | 'unknown'
  name?: string
}
type BrowserScreen = {
  height?: number
  isExtended?: boolean
  width?: number
}
type DisplayInfo = {
  activeState?: 'active' | 'inactive'
  bounds?: { width?: number; height?: number }
  isEnabled?: boolean
  isPrimary?: boolean
  refreshRate?: number
  modes?: Array<{
    height?: number
    heightInNativePixels?: number
    isNative?: boolean
    isSelected?: boolean
    refreshRate?: number
    width?: number
    widthInNativePixels?: number
  }>
  name?: string
}
type SystemApi = {
  cpu?: { getInfo?: () => Promise<CpuInfo> }
  memory?: { getInfo?: () => Promise<MemoryInfo> }
  storage?: { getInfo?: () => Promise<StorageInfo[]> }
  display?: { getInfo?: () => Promise<DisplayInfo[]> }
}
type GpuAdapter = { info?: { vendor?: string; architecture?: string; device?: string; description?: string } }
type NetworkInformation = { effectiveType?: string; downlink?: number; rtt?: number }
type RuntimeNavigator = Navigator & { connection?: NetworkInformation; gpu?: { requestAdapter?: () => Promise<GpuAdapter | null> } }
type RuntimePerformance = Performance & { memory?: { usedJSHeapSize?: number; jsHeapSizeLimit?: number } }
type CpuSample = {
  cpu_percent?: number
  uptime_seconds?: number
  cpu_model?: string
  cpu_arch?: string
  cpu_cores?: number
  cpu_temperature_c?: number
}
type CpuBaseline = { total: number; idle: number; counter_total: number; sampled_at: number }

let previousCpu: CpuBaseline | null = null
let cpuCounterScale: number | undefined
let gpuProbe: Promise<Pick<NonNullable<RuntimeMetrics['system']>, 'gpu_available' | 'gpu_model'>> | null = null

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
    const temperatures = (info.temperatures || []).filter((temperature): temperature is number => Number.isFinite(temperature))
    const metadata: CpuSample = {
      cpu_model: info.modelName,
      cpu_arch: info.archName,
      cpu_cores: Number.isInteger(info.numOfProcessors) ? info.numOfProcessors : undefined,
      cpu_temperature_c: temperatures.length ? Math.max(...temperatures) : undefined,
    }
    const usages = (info.processors || [])
      .map((processor) => processor.usage)
      .filter((usage): usage is CpuTime => usage != null && Number.isFinite(usage.total) && Number.isFinite(usage.idle))
    if (!usages.length) return metadata
    let total = 0
    let idle = 0
    for (const usage of usages) {
      total += usage.total || 0
      idle += usage.idle || 0
    }
    if (total <= 0) return metadata
    const counterTotal = Math.max(0, usages[0].total || 0)
    const current: CpuBaseline = { total, idle, counter_total: counterTotal, sampled_at: Date.now() }
    const baseline = previousCpu
    previousCpu = current
    if (baseline) {
      cpuCounterScale = inferCpuCounterScale(counterTotal - baseline.counter_total, current.sampled_at - baseline.sampled_at) || cpuCounterScale
    }
    const uptimeSeconds = cpuCounterScale ? Math.floor(counterTotal / cpuCounterScale / 1000) : undefined
    if (!baseline) return { ...metadata, uptime_seconds: uptimeSeconds }
    const totalDelta = current.total - baseline.total
    const idleDelta = current.idle - baseline.idle
    if (totalDelta <= 0) return { ...metadata, uptime_seconds: uptimeSeconds }
    return { ...metadata, cpu_percent: percent((1 - Math.max(0, idleDelta) / totalDelta) * 100), uptime_seconds: uptimeSeconds }
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
      if (!gpu?.requestAdapter) return { gpu_available: false }
      try {
        const adapter = await gpu.requestAdapter()
        if (!adapter) return { gpu_available: false }
        const info = adapter.info || {}
        const rawModel = [info.device, info.description].filter(Boolean).join(' ')
        const model = rawModel.match(/\b((?:RTX|GTX)\s*\d{3,4}(?:\s*(?:Ti|SUPER))?|RX\s*\d{3,4}|Arc\s*A\d+|Apple\s+M\d(?:\s+(?:Pro|Max|Ultra))?)\b/i)?.[1]
          ?.replace(/\s+/g, ' ')
          .replace(/^(RTX|GTX|RX)\s+(?=\d)/i, '$1')
          .trim()
        const vendorSource = [info.vendor, info.description, info.device].filter(Boolean).join(' ')
        const vendor = /nvidia/i.test(vendorSource)
          ? 'NVIDIA'
          : /intel/i.test(vendorSource)
            ? 'Intel'
            : /amd|advanced micro devices/i.test(vendorSource)
              ? 'AMD'
              : /apple/i.test(vendorSource)
                ? 'Apple'
                : undefined
        return { gpu_available: true, gpu_model: model || vendor }
      } catch {
        return { gpu_available: false }
      }
    })()
  }
  const result = await gpuProbe
  abortIfNeeded(signal)
  return result
}

async function readStorage(platform: string | undefined, signal?: AbortSignal) {
  const system = (extensionApi() as (ReturnType<typeof extensionApi> & { system?: SystemApi }) | undefined)?.system
  const getInfo = system?.storage?.getInfo
  if (!getInfo) return {}
  try {
    const info = await getInfo()
    abortIfNeeded(signal)
    const fixed = info.filter((unit) => unit.type === 'fixed')
    // Chromium's macOS provider enumerates mountable volumes. APFS therefore
    // exposes Data, Preboot, Recovery and other sibling volumes as if each were
    // a separate fixed device. The extension API does not expose their parent
    // physical disk, so present one capacity summary instead of inventing a
    // physical disk count or adding the shared APFS capacity repeatedly.
    if (platform === 'macOS') {
      const capacity = fixed.reduce((largest, unit) => Math.max(largest, Number(unit.capacity || 0)), 0)
      return capacity > 0
        ? { storage_capacity_bytes: capacity, storage_details: [{ capacity_bytes: capacity }] }
        : {}
    }
    const storageDetails = fixed.map((unit) => ({ capacity_bytes: Number(unit.capacity || 0) }))
    return {
      storage_count: fixed.length,
      storage_capacity_bytes: fixed.reduce((total, unit) => total + Number(unit.capacity || 0), 0),
      storage_details: storageDetails,
    }
  } catch {
    return {}
  }
}

function displayLabel(display: DisplayInfo, index: number, deviceScaleFactor?: number) {
  const name = display.name || `显示器 ${index + 1}`
  const nativeMode = display.modes?.find((candidate) => candidate.isNative) || display.modes?.find((candidate) => candidate.isSelected)
  const nativeWidth = Number(nativeMode?.widthInNativePixels || 0)
  const nativeHeight = Number(nativeMode?.heightInNativePixels || 0)
  const scale = typeof deviceScaleFactor === 'number' && Number.isFinite(deviceScaleFactor) && deviceScaleFactor > 1 ? deviceScaleFactor : 1
  const width = nativeWidth > 0 ? nativeWidth : Math.round(Number(display.bounds?.width || 0) * scale)
  const height = nativeHeight > 0 ? nativeHeight : Math.round(Number(display.bounds?.height || 0) * scale)
  const resolution = width >= 3800 && height >= 2100
    ? '4K'
    : width >= 2500 && height >= 1400
      ? '2K'
      : width >= 1900 && height >= 1000
        ? '1080P'
        : width >= 1200 && height >= 700
          ? '720P'
          : width > 0 && height > 0 ? `${width}×${height}` : undefined
  const selectedMode = display.modes?.find((candidate) => candidate.isSelected) || nativeMode
  const refreshRate = Number(selectedMode?.refreshRate || display.refreshRate || 0)
  return {
    label: name,
    resolution,
    refresh_rate_hz: refreshRate > 0 ? Math.round(refreshRate) : undefined,
  }
}

async function readDisplays(signal?: AbortSignal) {
  const system = (extensionApi() as (ReturnType<typeof extensionApi> & { system?: SystemApi }) | undefined)?.system
  const getInfo = system?.display?.getInfo
  if (getInfo) {
    try {
      const info = await getInfo()
      abortIfNeeded(signal)
      const displays = info.filter((display) => display.activeState !== 'inactive' && display.isEnabled !== false)
      const primary = displays.find((display) => display.isPrimary) || displays[0]
      const primaryIndex = primary ? displays.indexOf(primary) : -1
      const deviceScaleFactor = Number((globalThis as typeof globalThis & { devicePixelRatio?: number }).devicePixelRatio)
      return {
        display_count: displays.length,
        display_details: displays.map((display, index) => ({
          ...displayLabel(display, index, deviceScaleFactor),
          is_primary: index === primaryIndex,
        })),
      }
    } catch {
      // Fall through to the permission-free Screen API summary.
    }
  }

  const screen = (globalThis as typeof globalThis & { screen?: BrowserScreen }).screen
  const width = Number(screen?.width || 0)
  const height = Number(screen?.height || 0)
  // screen.width/height are the current logical resolution selected by macOS.
  // devicePixelRatio is a rendering scale, not a resolution multiplier: using
  // it here produced values such as 2940×1912 for a 1470×956 desktop mode.
  const resolution = width > 0 && height > 0 ? `${Math.round(width)}×${Math.round(height)}` : undefined
  const extended = typeof screen?.isExtended === 'boolean' ? screen.isExtended : undefined
  return {
    ...(extended == null ? {} : {
      display_count: extended ? 2 : 1,
      display_count_is_minimum: extended,
    }),
    ...(resolution ? {
      display_details: [{ label: '当前显示器', resolution, is_primary: extended === false }],
    } : {}),
  }
}

function readPlatform() {
  const runtimeNavigator = globalThis.navigator as RuntimeNavigator | undefined
  const raw = (runtimeNavigator as RuntimeNavigator & { userAgentData?: { platform?: string } } | undefined)?.userAgentData?.platform || runtimeNavigator?.platform
  if (!raw) return undefined
  if (/win/i.test(raw)) return 'Windows'
  if (/mac/i.test(raw)) return 'macOS'
  if (/cros/i.test(raw)) return 'ChromeOS'
  if (/linux/i.test(raw)) return 'Linux'
  return raw
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
  const platform = readPlatform()
  const [cpu, memory, gpu, storage, displays] = await Promise.all([readCpu(signal), readMemory(signal), readGpu(signal), readStorage(platform, signal), readDisplays(signal)])
  abortIfNeeded(signal)
  return {
    executionSource: 'browser',
    runtime: cpu?.uptime_seconds == null ? undefined : { uptime_seconds: cpu.uptime_seconds },
    system: {
      ...memory,
      platform,
      cpu_percent: cpu?.cpu_percent,
      cpu_model: cpu?.cpu_model,
      cpu_arch: cpu?.cpu_arch,
      cpu_cores: cpu?.cpu_cores,
      cpu_temperature_c: cpu?.cpu_temperature_c,
      ...gpu,
      gpu_percent: undefined,
      ...storage,
      ...displays,
    },
    network: readNetwork(),
  }
}
