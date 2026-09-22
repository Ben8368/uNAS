import { describe, expect, it } from 'vitest'

import { healthScore, healthStatus } from './utils'

describe('health score', () => {
  it('uses CPU and memory weights from the health explanation', () => {
    expect(healthScore(20.9, 52.01)).toBe(69)
  })

  it('clamps the score and maps the status bands', () => {
    expect(healthScore(0, 0)).toBe(100)
    expect(healthScore(100, 100)).toBe(20)
    expect(healthStatus(80)).toBe('正常')
    expect(healthStatus(60)).toBe('关注')
    expect(healthStatus(59)).toBe('偏高')
  })

  it('returns unavailable when either sample is missing', () => {
    expect(healthScore(undefined, 20)).toBeUndefined()
    expect(healthStatus(undefined)).toBe('未支持')
  })
})
