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
        { label: 'Primary', resolution: '3840×2160', refresh_rate_hz: 144, is_primary: true },
        { label: 'Secondary', resolution: '1920×1080', is_primary: false },
      ],
    })
  })

  it('summarizes macOS APFS volumes without treating each mount as a hard disk', async () => {
    vi.stubGlobal('browser', {
      system: {
        storage: { getInfo: vi.fn().mockResolvedValue([
          { type: 'fixed', name: 'Preboot', capacity: 550_000_000 },
          { type: 'fixed', name: 'Macintosh HD', capacity: 494_384_795_648 },
          { type: 'fixed', name: 'Data', capacity: 494_384_795_648 },
          { type: 'fixed', name: 'Recovery', capacity: 550_000_000 },
        ]) },
      },
    })
    vi.stubGlobal('navigator', { onLine: true, platform: 'MacIntel' })
    vi.stubGlobal('screen', { width: 1470, height: 956, isExtended: false })
    vi.stubGlobal('devicePixelRatio', 2)

    const metrics = await readBrowserSystemMetrics()

    expect(metrics.system).toMatchObject({
      platform: 'macOS',
      storage_capacity_bytes: 494_384_795_648,
      storage_details: [{ capacity_bytes: 494_384_795_648 }],
      display_count: 1,
      display_count_is_minimum: false,
      display_details: [{ label: '当前显示器', resolution: '1470×956', is_primary: true }],
    })
    expect(metrics.system?.storage_count).toBeUndefined()
  })

  it('restores Windows physical panel resolution from scaled Screen API pixels', async () => {
    vi.stubGlobal('browser', { system: {} })
    vi.stubGlobal('navigator', { onLine: true, platform: 'Win32' })
    vi.stubGlobal('screen', { width: 2262, height: 1273, isExtended: false })
    vi.stubGlobal('devicePixelRatio', 1.697)

    const metrics = await readBrowserSystemMetrics()

    expect(metrics.system).toMatchObject({
      platform: 'Windows',
      display_count: 1,
      display_count_is_minimum: false,
      display_details: [{ label: '当前显示器', resolution: '3840×2160', is_primary: true }],
    })
  })

  it('normalizes scaled display API bounds on Windows without scaling macOS logical bounds', async () => {
    vi.stubGlobal('browser', {
      system: {
        display: { getInfo: vi.fn().mockResolvedValue([{ name: 'Primary', isPrimary: true, bounds: { width: 2262, height: 1273 } }]) },
      },
    })
    vi.stubGlobal('navigator', { onLine: true, platform: 'Win32' })
    vi.stubGlobal('devicePixelRatio', 1.697)

    const windowsMetrics = await readBrowserSystemMetrics()

    expect(windowsMetrics.system?.display_details).toEqual([
      { label: 'Primary', resolution: '3840×2160', is_primary: true },
    ])

    vi.stubGlobal('browser', {
      system: {
        display: { getInfo: vi.fn().mockResolvedValue([{ name: 'Built-in Display', isPrimary: true, bounds: { width: 1470, height: 956 } }]) },
      },
    })
    vi.stubGlobal('navigator', { onLine: true, platform: 'MacIntel' })
    vi.stubGlobal('devicePixelRatio', 2)

    const macMetrics = await readBrowserSystemMetrics()

    expect(macMetrics.system?.display_details).toEqual([
      { label: 'Built-in Display', resolution: '1470×956', is_primary: true },
    ])
  })

  it('removes browser zoom from Windows display scaling before restoring panel pixels', async () => {
    vi.stubGlobal('browser', {
      tabs: {
        create: vi.fn(),
        getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
        getZoom: vi.fn().mockResolvedValue(2),
      },
      system: {
        display: { getInfo: vi.fn().mockResolvedValue([{ name: 'Primary', isPrimary: true, bounds: { width: 2262, height: 1273 } }]) },
      },
    })
    vi.stubGlobal('navigator', { onLine: true, platform: 'Win32' })
    vi.stubGlobal('devicePixelRatio', 3.394)

    const metrics = await readBrowserSystemMetrics()

    expect(metrics.system?.display_details).toEqual([
      { label: 'Primary', resolution: '3840×2160', is_primary: true },
    ])
  })

  it('reports a lower bound when Screen API only reveals that multiple displays exist', async () => {
    vi.stubGlobal('browser', { system: {} })
    vi.stubGlobal('navigator', { onLine: true, platform: 'MacIntel' })
    vi.stubGlobal('screen', { width: 1920, height: 1080, isExtended: true })
    vi.stubGlobal('devicePixelRatio', 1)

    const metrics = await readBrowserSystemMetrics()

    expect(metrics.system).toMatchObject({
      display_count: 2,
      display_count_is_minimum: true,
      display_details: [{ label: '当前显示器', resolution: '1920×1080', is_primary: false }],
    })
  })
})

for (const viaDisplayApi of [false, true]) {
  for (const zoom of [0.5, 0.8, 1, 2]) {
    it('restores Windows 125% display scaling at zoom ' + zoom + ' via display API: ' + viaDisplayApi, async () => {
      vi.stubGlobal('browser', {
        tabs: { getCurrent: async () => ({ id: 1 }), getZoom: async () => zoom },
        system: viaDisplayApi ? { display: { getInfo: async () => [{ bounds: { width: 1536, height: 864 } }] } } : {},
      })
      vi.stubGlobal('navigator', { platform: 'Win32', onLine: true })
      vi.stubGlobal('screen', { width: 1536, height: 864, isExtended: false })
      vi.stubGlobal('devicePixelRatio', 1.25 * zoom)
      const metrics = await readBrowserSystemMetrics()
      expect(metrics.system?.display_details?.[0].resolution).toBe('1920×1080')
    })
  }
}
