import { beforeEach, describe, expect, it, vi } from 'vitest'
import { demoApi } from './demo'
import { demoScenarios, type MockFileMetadata } from './demo/contracts'

beforeEach(() => { demoApi.resetDemoScenario('initial-state') })

describe('deterministic mock scenario runtime', () => {
  it('only protects user-submitted work, never scenario fixtures', async () => {
    expect(demoApi.getDemoSnapshot().hasPendingUserTasks).toBe(false)
    const job = await demoApi.submitDemoTool('image')
    expect(demoApi.getDemoSnapshot().hasPendingUserTasks).toBe(true)
    await demoApi.cancelJob(job.id)
    expect(demoApi.getDemoSnapshot().hasPendingUserTasks).toBe(false)
    expect(demoApi.getDemoSnapshot().jobs.some(job => job.status === 'running')).toBe(true)
  })
  it('clears close protection on completion, failure, owner loss and reset', async () => {
    await demoApi.submitFetch({ url: 'https://example.com/a' })
    expect(demoApi.getDemoSnapshot().hasPendingUserTasks).toBe(true)
    demoApi.advanceDemoScenario()
    expect(demoApi.getDemoSnapshot().hasPendingUserTasks).toBe(true)
    demoApi.advanceDemoScenario()
    expect(demoApi.getDemoSnapshot().hasPendingUserTasks).toBe(false)
    await demoApi.submitDemoTool('pdf')
    expect(demoApi.interruptDemoTasks().hasPendingUserTasks).toBe(false)
    await demoApi.submitDemoTool('archive')
    expect(demoApi.resetDemoScenario('initial-state').hasPendingUserTasks).toBe(false)
    demoApi.resetDemoScenario('task-failed')
    await demoApi.submitDemoTool('image')
    expect(demoApi.getDemoSnapshot().hasPendingUserTasks).toBe(false)
  })
  it('replays fixed IDs, timestamps, jobs and steps exactly after reset', async () => {
    async function play() {
      demoApi.resetDemoScenario('task-running')
      await demoApi.submitFetch({ urls: ['https://example.com/a', 'https://example.com/b'] })
      await demoApi.submitTranscodeJob({ outputPath: '/pretend/output.mp4' })
      demoApi.advanceDemoScenario(); return demoApi.advanceDemoScenario()
    }
    const first = await play(); const second = await play()
    expect(second).toEqual(first)
    expect(second.jobs.every(j => j.status === 'succeeded' && j.executionSource === 'mock')).toBe(true)
    expect(second.assets.some(a => a.path === '/pretend/output.mp4')).toBe(false)
    expect(JSON.parse(JSON.stringify(second))).toEqual(second)
  })
  it('exposes every scenario and rejects unknown scenarios', () => {
    for (const scenario of demoScenarios) expect(demoApi.resetDemoScenario(scenario.id).scenarioId).toBe(scenario.id)
    expect(() => demoApi.resetDemoScenario('invalid' as never)).toThrow('未知')
  })
  it.each(demoScenarios)('replays the full $id snapshot independently of prior state', async ({ id }) => {
    const first = demoApi.resetDemoScenario(id)
    demoApi.resetDemoScenario('initial-state')
    await demoApi.submitFetch({ url: 'https://example.com/changed' })
    await demoApi.deleteFilebrowserPath('/Workspace/Images')
    demoApi.advanceDemoScenario()
    expect(demoApi.resetDemoScenario(id)).toEqual(first)
  })
  it('provides empty directories, cancelled terminal tasks and explicit owner-loss fixtures', async () => {
    const empty = demoApi.resetDemoScenario('empty-state')
    expect(empty).toMatchObject({ jobs: [], tasks: [], assets: [] })
    const root = await demoApi.listFilebrowserDirectory({ directory: '/Workspace' })
    expect(root.files).toEqual([])
    for (const directory of root.directories) expect((await demoApi.listFilebrowserDirectory({ directory: directory.path })).files).toEqual([])
    const cancelled = demoApi.resetDemoScenario('task-cancelled')
    expect(cancelled.tasks[0].status).toBe('cancelled')
    expect(cancelled.jobs.find(job => job.id === cancelled.tasks[0].id)?.status).toBe('canceled')
    const lost = demoApi.resetDemoScenario('owner-lost')
    expect(lost.tasks[0]).toMatchObject({ status: 'failed', error: expect.stringContaining('OWNER_LOST') })
  })
  it('notifies subscribers and isolates returned projections', async () => {
    const notify = vi.fn(); const unsubscribe = demoApi.subscribeDemo(notify)
    const job = await demoApi.submitDemoTool('image', 'sample-image')
    expect(notify).toHaveBeenCalledOnce()
    job.status = 'canceled'
    expect((await demoApi.getJob(job.id)).job?.status).toBe('running')
    const snapshot = demoApi.getDemoSnapshot(); snapshot.jobs.length = 0
    expect(demoApi.getDemoSnapshot().jobs.length).toBeGreaterThan(0)
    unsubscribe(); demoApi.advanceDemoScenario(); expect(notify).toHaveBeenCalledOnce()
  })
  it('unifies cancellation in both task projections without rewriting terminal jobs', async () => {
    const first = await demoApi.submitFetch({ url: 'https://example.com/a' })
    await demoApi.cancelTask(first.task_id!)
    expect((await demoApi.getJob(first.task_id!)).job?.status).toBe('canceled')
    const second = await demoApi.submitFetch({ url: 'https://example.com/b' })
    await demoApi.cancelJob(second.task_id!)
    expect((await demoApi.getWeeklyHistory()).tasks?.find(t => t.task_id === second.task_id)?.status).toBe('cancelled')
    demoApi.advanceDemoScenario(); demoApi.advanceDemoScenario()
    expect((await demoApi.getJob(second.task_id!)).job?.status).toBe('canceled')
    expect(await demoApi.cancelJob('demo-transcode-001')).toMatchObject({ ok: false })
    expect((await demoApi.getJob('demo-transcode-001')).job?.status).toBe('succeeded')
  })
  it('prevents deletion of active records and clears both projections after cancellation', async () => {
    await expect(demoApi.deleteTaskRecord('demo-download-001')).rejects.toThrow('先取消')
    await demoApi.cancelTask('demo-download-001'); await demoApi.deleteTaskRecord('demo-download-001')
    expect((await demoApi.getJob('demo-download-001')).ok).toBe(false)
    expect((await demoApi.getWeeklyHistory()).tasks).toEqual([])
  })
  it('distinguishes workspace interruption from cancellation and keeps both projections consistent', () => {
    const snapshot = demoApi.interruptDemoTasks()
    expect(snapshot.jobs.find(j => j.id === 'demo-download-001')).toMatchObject({ status: 'failed', errorMessage: expect.stringContaining('OWNER_LOST') })
    expect(snapshot.tasks[0]).toMatchObject({ status: 'failed', error: expect.stringContaining('OWNER_LOST') })
  })
  it('models capability denials and resource / owner failures without desktop calls', async () => {
    expect(await demoApi.requestReadGrant()).toMatchObject({ status: 'granted', executionSource: 'mock', grant: { id: 'mock-grant-file.read' } })
    demoApi.resetDemoScenario('permission-denied'); expect(await demoApi.requestReadGrant()).toMatchObject({ status: 'denied' })
    demoApi.resetDemoScenario('capability-unavailable'); expect(await demoApi.requestWriteGrant()).toMatchObject({ status: 'unavailable' })
    demoApi.resetDemoScenario('resource-limit'); await expect(demoApi.submitDemoTool('pdf')).rejects.toThrow('RESOURCE_LIMIT')
    demoApi.resetDemoScenario('workspace-conflict'); await expect(demoApi.submitTranscodeJob({})).rejects.toThrow('OWNER_CONFLICT')
  })
  it('does not commit a batch with an invalid URL', async () => {
    const previous = demoApi.getDemoSnapshot()
    await expect(demoApi.submitFetch({ urls: ['https://example.com/a', 'javascript:alert(1)'] })).rejects.toThrow('HTTPS')
    expect(demoApi.getDemoSnapshot()).toEqual(previous)
  })
  it('keeps declared simulated options and rejects browser credentials before creating jobs', async () => {
    const before = demoApi.getDemoSnapshot()
    await expect(demoApi.submitFetch({ url: 'https://example.com/a', cookies_from_browser: 'chrome' })).rejects.toThrow('不读取浏览器登录态')
    expect(demoApi.getDemoSnapshot()).toEqual(before)
    await expect(demoApi.submitFetch({ url: 'https://example.com/a', output_dir: '/Workspace/Exports' })).rejects.toThrow('浏览器默认下载位置')
    const created = await demoApi.submitFetch({ url: 'https://example.com/a', compatible_format: true, max_concurrent: 1 })
    const task = (await demoApi.getWeeklyHistory()).tasks!.find(t => t.id === created.task_id)!
    expect(task.params).toEqual({ url: 'https://example.com/a', urls: ['https://example.com/a'], mode: 'video', output_dir: 'browser-default-downloads', compatible_format: true, max_concurrent: 1 })
    expect(task.output_files).toEqual([])
    const strategy = await demoApi.analyzeDownloadStrategy({ url: 'https://example.com/a' })
    expect(strategy.analysis?.ytdlp_scope).toMatchObject({ supports_generic_extractor: false, supports_embeds: false, media: [] })
    expect(strategy.analysis?.reason).toContain('不代表站点支持')
  })
  it('rejects already aborted directory and job queries', async () => {
    const controller = new AbortController(); controller.abort()
    await expect(demoApi.getJob('demo-download-001', controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    await expect(demoApi.listFilebrowserDirectory({ directory: '/Workspace' }, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('pure metadata file fixtures', () => {
  it('returns correct child paths and cloned entries', async () => {
    const result = await demoApi.listFilebrowserDirectory({ directory: '/Workspace/Downloads' })
    expect(result.files[0]).toMatchObject({ path: '/Workspace/Downloads/brand-track.mp3', executionSource: 'mock' })
    result.files.length = 0
    expect((await demoApi.listFilebrowserDirectory({ directory: '/Workspace/Downloads' })).files).toHaveLength(2)
  })
  it('accepts only declared fixture references without inspecting real metadata', async () => {
    await demoApi.uploadFilebrowserFile('/Workspace', { fixtureId: 'sample-image', executionSource: 'mock' })
    expect((await demoApi.listFilebrowserDirectory({ directory: '/Workspace' })).files).toContainEqual(expect.objectContaining({ name: 'sample-image.png', size: 1_240_000 }))
    const fakeFile = Object.create({ name: 'private.txt', size: 20 })
    Object.defineProperty(fakeFile, 'name', { get: () => { throw new Error('should not inspect a file') } })
    await expect(demoApi.uploadFilebrowserFile('/Workspace', fakeFile)).rejects.toThrow('只接受内置模拟文件')
    await expect(demoApi.uploadFilebrowserFile('/Workspace', { executionSource: 'mock', fixtureId: 'sample-video', name: 'private' } as MockFileMetadata)).rejects.toThrow('只接受')
  })
  it('preserves the whole deleted tree until restore, including conflict protection', async () => {
    await demoApi.deleteFilebrowserPath('/Workspace/Images')
    expect((await demoApi.fetchAssets()).assets.some(a => a.kind === 'image')).toBe(false)
    const [trashed] = (await demoApi.fetchFilebrowserTrash()).items!
    await expect(demoApi.listFilebrowserDirectory({ directory: '/Workspace/Images' })).rejects.toThrow('不存在')
    await demoApi.createFilebrowserDirectory('/Workspace/Images')
    await expect(demoApi.restoreFilebrowserTrash(trashed.id)).rejects.toThrow('名称冲突')
    expect((await demoApi.fetchFilebrowserTrash()).items).toHaveLength(1)
    await demoApi.deleteFilebrowserPath('/Workspace/Images', false)
    await demoApi.restoreFilebrowserTrash(trashed.id)
    expect(demoApi.getDemoSnapshot().assets.some(a => a.kind === 'image')).toBe(true)
    expect((await demoApi.listFilebrowserDirectory({ directory: '/Workspace/Images' })).files).toHaveLength(2)
    expect((await demoApi.fetchFilebrowserTrash()).items).toEqual([])
  })
  it('creates browseable folders and rejects traversal, missing parents and duplicates', async () => {
    await demoApi.createFilebrowserDirectory('/Workspace/New')
    expect((await demoApi.listFilebrowserDirectory({ directory: '/Workspace/New' })).files).toEqual([])
    await expect(demoApi.createFilebrowserDirectory('/Workspace/New')).rejects.toThrow('冲突')
    await expect(demoApi.createFilebrowserDirectory('/Workspace/missing/child')).rejects.toThrow('不存在')
    await expect(demoApi.createFilebrowserDirectory('/Workspace/../escape')).rejects.toThrow('规范路径')
    await expect(demoApi.deleteFilebrowserPath('/Workspace')).rejects.toThrow('根目录')
  })
  it('purges deleted metadata and resets all file mutations', async () => {
    await demoApi.deleteFilebrowserPath('/Workspace/Images')
    const [item] = (await demoApi.fetchFilebrowserTrash()).items!
    await demoApi.purgeFilebrowserTrash(item.id)
    await expect(demoApi.restoreFilebrowserTrash(item.id)).rejects.toThrow('不存在')
    demoApi.resetDemoScenario('initial-state')
    expect((await demoApi.listFilebrowserDirectory({ directory: '/Workspace/Images' })).files).toHaveLength(2)
  })
  it('produces repeatable partial failures, while successful fixture operations remain visible', async () => {
    demoApi.resetDemoScenario('partial-failure')
    const result = await Promise.allSettled(['sample-image', 'sample-document'].map(fixtureId => demoApi.uploadFilebrowserFile('/Workspace', { fixtureId, executionSource: 'mock' } as MockFileMetadata)))
    expect(result.map(r => r.status)).toEqual(['fulfilled', 'rejected'])
    expect((await demoApi.listFilebrowserDirectory({ directory: '/Workspace' })).files.map(f => f.name)).toContain('sample-image.png')
  })
  it('never returns an icon or any download URL as a task/file result', () => {
    expect(() => demoApi.filebrowserFileDownloadUrl('/Workspace/a')).toThrow('无法下载')
    expect(() => demoApi.getFetchTaskFileUrl('demo-download-001', '/a')).toThrow('无法下载')
  })
})
