import { afterEach, describe, expect, it, vi } from 'vitest'

import { readBrowserSystemMetrics } from './systemMetrics'

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('browser system metrics', () => {
  it('derives approximate system uptime from cumulative CPU time', async () => {
    const getInfo = vi.fn()
      .mockResolvedValueOnce({ modelName: 'Test CPU', archName: 'x86-64', numOfProcessors: 8, temperatures: [61, 64], processors: [{ usage: { total: 12_345_678_000, idle: 6_000_000_000 } }] })
      .mockResolvedValueOnce({ modelName: 'Test CPU', archName: 'x86-64', numOfProcessors: 8, temperatures: [61, 64], processors: [{ usage: { total: 12_346_678_000, idle: 6_000_500_000 } }] })
    vi.stubGlobal('browser', {
      system: {
        cpu: { getInfo },
        storage: { getInfo: vi.fn().mockResolvedValue([{ type: 'fixed', capacity: 2_000_000_000_000 }, { type: 'removable', capacity: 32_000_000_000 }]) },
        display: { getInfo: vi.fn().mockResolvedValue([
          { name: 'Primary', isPrimary: true, bounds: { width: 2560, height: 1440 }, modes: [{ isNative: true, isSelected: true, widthInNativePixels: 3840, heightInNativePixels: 2160, refreshRate: 144 }] },
          { name: 'Secondary', isPrimary: false, bounds: { width: 1920, height: 1080 } },
        ]) },
      },
    })
    vi.stubGlobal('navigator', { onLine: true, platform: 'Win32' })
    vi.useFakeTimers()

    const first = await readBrowserSystemMetrics()
    expect(first.runtime).toBeUndefined()
    expect(first.system?.cpu_percent).toBeUndefined()

    vi.advanceTimersByTime(1_000)
    const second = await readBrowserSystemMetrics()
    expect(second.runtime).toEqual({ uptime_seconds: 12_346 })
    expect(second.system?.cpu_percent).toBe(50)
    expect(second.system).toMatchObject({
      platform: 'Windows',
      cpu_model: 'Test CPU',
      cpu_arch: 'x86-64',
      cpu_cores: 8,
      cpu_temperature_c: 64,
      storage_count: 1,
      storage_capacity_bytes: 2_000_000_000_000,
      display_count: 2,
      storage_details: [{ capacity_bytes: 2_000_000_000_000 }],
      display_details: [
        { label: 'Primary', resolution: '4K', refresh_rate_hz: 144, is_primary: true },
        { label: 'Secondary', resolution: '1080P', is_primary: false },
      ],
    })
  })
})
