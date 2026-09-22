import { afterEach, describe, expect, it, vi } from 'vitest'

import { readBrowserSystemMetrics } from './systemMetrics'

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('browser system metrics', () => {
  it('derives approximate system uptime from cumulative CPU time', async () => {
    const getInfo = vi.fn()
      .mockResolvedValueOnce({ processors: [{ usage: { total: 12_345_678_000, idle: 6_000_000_000 } }] })
      .mockResolvedValueOnce({ processors: [{ usage: { total: 12_346_678_000, idle: 6_000_500_000 } }] })
    vi.stubGlobal('browser', { system: { cpu: { getInfo } } })
    vi.stubGlobal('navigator', { onLine: true })
    vi.useFakeTimers()

    const first = await readBrowserSystemMetrics()
    expect(first.runtime).toBeUndefined()
    expect(first.system?.cpu_percent).toBeUndefined()

    vi.advanceTimersByTime(1_000)
    const second = await readBrowserSystemMetrics()
    expect(second.runtime).toEqual({ uptime_seconds: 12_346 })
    expect(second.system?.cpu_percent).toBe(50)
  })
})
