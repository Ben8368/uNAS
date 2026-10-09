import { describe, expect, it } from 'vitest'

import { compactCpuModel, formatCompactUptime, healthScore, healthStatus } from './utils'

describe('health score', () => {
  it('uses CPU and memory weights from the health explanation', () => {
    expect(healthScore(20.9, 52.01)).toBe(69)
  })

  it('clamps the score and maps the status bands', () => {
    expect(healthScore(0, 0)).toBe(100)
    expect(healthScore(100, 100)).toBe(20)
    expect(healthStatus(80)).toBe('资源充足')
    expect(healthStatus(60)).toBe('资源可用')
    expect(healthStatus(59)).toBe('资源紧张')
  })

  it('returns unavailable when either sample is missing', () => {
    expect(healthScore(undefined, 20)).toBeUndefined()
    expect(healthStatus(undefined)).toBe('未支持')
  })
})

describe('compact system detail formatting', () => {
  it('keeps uptime details on one short line', () => {
    expect(formatCompactUptime(7 * 86400 + 16 * 3600 + 21 * 60)).toBe('7 天 16 小时 21 分 0 秒')
    expect(formatCompactUptime(2 * 3600 + 3 * 60 + 4)).toBe('2 小时 3 分 4 秒')
  })

  it('removes noisy CPU branding suffixes', () => {
    expect(compactCpuModel('Intel(R) Core(TM) i7-10700 CPU @ 2.90GHz')).toBe('Intel Core i7-10700 @ 2.90GHz')
  })
})
