import { describe, expect, it } from 'vitest'
import { demoApi } from 'unas-src/api/demo'
import { MAX_MESSAGE_BYTES, validCall, validMessage } from './workspaceProtocol'

describe('inline Workspace message boundary', () => {
  it('accepts bounded bundled Files and Downloader requests', () => {
    expect(validCall('submitFetch', [{ urls: ['https://example.com/a'], output_dir: '/Workspace/Downloads', max_concurrent: 1 }])).toBe(true)
    expect(validCall('listFilebrowserDirectory', [{ directory: '/Workspace' }])).toBe(true)
    expect(validCall('cancelTask', ['demo-job-001'])).toBe(true)
    expect(validCall('uploadFilebrowserFile', ['/Workspace', { executionSource: 'mock', fixtureId: 'sample-image' }])).toBe(true)
  })
  it('rejects prototype methods, scenario control, oversized and unexpected arguments', () => {
    for (const method of ['__proto__', 'constructor', 'toString', 'resetDemoScenario', 'interruptDemoTasks', 'advanceDemoScenario']) expect(validCall(method, [])).toBe(false)
    expect(validCall('submitFetch', [{ urls: Array(21).fill('https://example.com') }])).toBe(false)
    expect(validCall('submitFetch', [{ url: 'https://example.com', unknown: true }])).toBe(false)
    expect(validCall('listFilebrowserDirectory', [{ directory: '/Workspace', script: 'code' }])).toBe(false)
    expect(validCall('uploadFilebrowserFile', ['/Workspace', { executionSource: 'mock', fixtureId: 'sample-image', blob: {} }])).toBe(false)
  })
  it('requires a versioned envelope and bounded snapshot', () => {
    const message = { version: 2, type: 'snapshot', sender: 'owner', owner: 'owner', snapshot: demoApi.getDemoSnapshot() }
    expect(validMessage(message)).toBe(true)
    expect(validMessage({ ...message, version: 1 })).toBe(false)
    expect(validMessage({ ...message, snapshot: { jobs: [] } })).toBe(false)
    expect(validMessage({ ...message, value: 'x'.repeat(MAX_MESSAGE_BYTES) })).toBe(false)
  })
})
