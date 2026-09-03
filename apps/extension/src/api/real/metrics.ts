import { apiRequest } from 'unas-src/api/http'
import type { RuntimeMetricsSlice } from 'unas-src/api/types'
import type { RuntimeMetrics } from 'unas-src/components/RightPanel/types'

export async function getSystemMetrics(signal?: AbortSignal) {
  return apiRequest<RuntimeMetrics>('/api/system/metrics', { signal })
}

export async function fetchSystemRuntimeMetrics(signal?: AbortSignal) {
  return apiRequest<RuntimeMetricsSlice>('/api/system/runtime', { signal })
}

export async function shutdownSystem() {
  return apiRequest<{ ok: boolean }>('/api/system/shutdown', {
    method: 'POST',
    headers: { 'x-unas-shutdown': 'desktop' },
  })
}
