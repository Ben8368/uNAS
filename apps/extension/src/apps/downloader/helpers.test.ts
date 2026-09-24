import { describe, expect, it } from 'vitest'

import {
  buildRetryPayload,
  getTaskDownloadFilePath,
  isTaskCancellable,
  isTaskRetryable,
} from 'unas-src/apps/downloader/helpers'
import type { DownloadTask } from 'unas-src/apps/downloader/types'

function task(overrides: Partial<DownloadTask>): DownloadTask {
  return {
    id: 'task-1',
    type: 'download',
    name: 'https://example.com/video',
    status: 'failed',
    progress: 0,
    stage: 'failed',
    created_at: 1,
    ...overrides,
  }
}

it('does not offer in-app cancellation for a browser download without a saved record', () => {
  expect(isTaskCancellable(task({ executionSource: 'real', status: 'running', params: { browser_download_tracked: false } }))).toBe(false)
  expect(isTaskCancellable(task({ executionSource: 'real', status: 'running', params: { browser_download_tracked: true } }))).toBe(true)
})

describe('buildRetryPayload', () => {
  it('normalizes url into urls for retry submissions', () => {
    const payload = buildRetryPayload(task({ params: { url: ' https://example.com/a ' } }))

    expect(payload).toEqual({ url: ' https://example.com/a ', urls: ['https://example.com/a'] })
  })

  it('filters invalid urls values and preserves other params', () => {
    const payload = buildRetryPayload(task({
      params: {
        output_dir: 'downloads',
        urls: ['https://example.com/a', '', 42, ' https://example.com/b '],
      },
    }))

    expect(payload).toEqual({
      output_dir: 'downloads',
      urls: ['https://example.com/a', 'https://example.com/b'],
    })
  })

  it('returns null when a task has no retryable source URL', () => {
    expect(buildRetryPayload(task({ name: '', params: {}, source_url: '3 URLs' }))).toBeNull()
  })
})

describe('task file helpers', () => {
  it('prefers output_files over nested result paths', () => {
    const value = getTaskDownloadFilePath(task({
      output_files: [' C:/downloads/final.mp4 '],
      result: {
        items: [{ info: { local_path: 'C:/downloads/fallback.mp4' } }],
      },
    }))

    expect(value).toBe('C:/downloads/final.mp4')
  })

  it('falls back to local media and subtitle paths from result info', () => {
    expect(getTaskDownloadFilePath(task({
      result: { items: [{ info: { local_path: 'C:/downloads/video.mp4' } }] },
    }))).toBe('C:/downloads/video.mp4')

    expect(getTaskDownloadFilePath(task({
      result: { items: [{ info: { subtitle_path: 'C:/downloads/subtitle.srt' } }] },
    }))).toBe('C:/downloads/subtitle.srt')
  })
})

describe('isTaskRetryable', () => {
  it('requires a terminal status and a retryable URL', () => {
    expect(isTaskRetryable(task({ status: 'failed', params: { urls: ['https://example.com/a'] } }))).toBe(true)
    expect(isTaskRetryable(task({ status: 'running', params: { urls: ['https://example.com/a'] } }))).toBe(false)
    expect(isTaskRetryable(task({ status: 'failed', params: {} }))).toBe(false)
  })
})

// An external transfer is a UI projection, not a successful/failed engine task.
describe('untracked browser download projection', () => {
  it('does not claim progress or a terminal outcome and can be removed', async () => {
    const { createOptimisticTask, computeStats, getCategoryForTask, isTaskClearable } = await import('./helpers')
    const external = createOptimisticTask('https://example.test/a.zip', { browser_download_id: 42, browser_download_tracked: false }, { task_id: 'browser-download-42', status: 'running', executionSource: 'real' })
    expect(external.status).toBe('external')
    expect(external.stage).toContain('状态未知')
    expect(isTaskCancellable(external)).toBe(false)
    expect(isTaskRetryable(external)).toBe(false)
    expect(isTaskClearable(external)).toBe(true)
    expect(getCategoryForTask(external)).toBe('all')
    expect(computeStats([external])).toEqual({ all: 1, downloading: 0, completed: 0, paused: 0, error: 0 })
  })
})
