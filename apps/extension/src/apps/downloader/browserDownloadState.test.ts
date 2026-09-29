import { describe, expect, it } from 'vitest'
import { applyDownloadObservation, canRecheckDownload } from './browserDownloadState'
import type { DownloadTask } from './types'
import { isTaskClearable } from './helpers'
const running: DownloadTask = { executionSource: 'real', id: '1', name: 'test', type: 'download', status: 'running', stage: '', progress: 25, created_at: 0 }
describe('browser download observation', () => {
  it('only offers recheck for an owned tracked unknown download', () => {
    const task = { ...running, status: 'external' as const, params: { browser_download_id: 42 } }
    expect(canRecheckDownload(task)).toBe(true)
    expect(canRecheckDownload({ ...task, status: 'running' })).toBe(false)
    expect(canRecheckDownload({ ...task, executionSource: 'mock' })).toBe(false)
    expect(canRecheckDownload({ ...task, params: { ...task.params, browser_download_tracked: false } })).toBe(false)
  })
  it('makes a missing record clearable without claiming the transfer failed', () => {
    const task = applyDownloadObservation(running, { info: null })
    expect(task.status).toBe('external')
    expect(task.stage).toContain('状态未知')
    expect(isTaskClearable(task)).toBe(true)
  })
  it('bounds transient failure retries and preserves the last known progress', () => {
    expect(applyDownloadObservation(running, { error: 'offline' }, 2).status).toBe('running')
    expect(applyDownloadObservation(running, { error: 'offline' }, 3)).toMatchObject({ status: 'external', progress: 25, error: 'offline' })
  })
  it('clears query errors on recovery and handles unknown content length at completion', () => {
    const task = applyDownloadObservation({ ...running, error: 'timeout' }, { info: { id: 1, state: 'complete', bytesReceived: 4, totalBytes: 0 } })
    expect(task).toMatchObject({ status: 'completed', progress: 100, error: undefined })
  })
})
