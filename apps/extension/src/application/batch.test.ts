import { describe, expect, it } from 'vitest'
import { describeBatch, runBatch } from './batch'

describe('batch command settlement', () => {
  it('keeps committed successes and names failed items for retry', async () => {
    const committed: string[] = []
    const result = await runBatch(['first', 'locked', 'last'], async (item) => {
      if (item === 'locked') throw new Error('权限拒绝')
      await Promise.resolve()
      committed.push(item)
    })
    expect(committed).toEqual(['first', 'last'])
    expect(result).toEqual({ succeeded: ['first', 'last'], failed: [{ item: 'locked', message: '权限拒绝' }], partial: true })
    expect(describeBatch('恢复', result)).toContain('可重试失败项：locked（权限拒绝）')
  })

  it('bounds concurrency and settles synchronous failures without skipping later commands', async () => {
    let active = 0
    let peak = 0
    const result = await runBatch(Array.from({ length: 11 }, (_, index) => index), (item) => {
      if (item === 1) throw new Error('invalid')
      active += 1
      peak = Math.max(peak, active)
      return Promise.resolve().then(() => { active -= 1 })
    })
    expect(peak).toBeLessThanOrEqual(4)
    expect(result.succeeded).toHaveLength(10)
    expect(result.failed[0].item).toBe(1)
  })

  it('treats a resolved command refusal as failure instead of fake success', async () => {
    const result = await runBatch(['denied'], async () => ({ ok: false, message: '权限拒绝' }))
    expect(result.succeeded).toEqual([])
    expect(result.failed).toEqual([{ item: 'denied', message: '权限拒绝' }])
  })
})
