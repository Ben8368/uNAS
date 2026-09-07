import { test, expect } from './fixtures'

type WorkerVersion = { versionId: string; scriptURL: string; runningStatus: 'stopped' | 'starting' | 'running' | 'stopping' }

async function legacyLaunch(page: import('@playwright/test').Page) {
  return page.evaluate(async () => browser.runtime.sendMessage({
    schemaVersion: 1,
    action: 'workspace.launch',
    appId: 'fetcher',
  }))
}

const legacyLaunchRejection = {
  ok: false,
  error: 'App 已改为当前标签页打开，请刷新旧的 uNAS 页面后重试。',
}

test('forced Service Worker termination preserves the runtime rejection boundary after wake', async ({ extension }) => {
  const page = await extension.context.newPage()
  await page.goto(`chrome-extension://${extension.extensionId}/newtab.html`)
  const cdp = await extension.context.newCDPSession(page)
  let versions: WorkerVersion[] = []
  cdp.on('ServiceWorker.workerVersionUpdated', event => {
    versions = (event as { versions?: WorkerVersion[] }).versions ?? versions
  })
  await cdp.send('ServiceWorker.enable')

  await expect.poll(() => legacyLaunch(page)).toEqual(legacyLaunchRejection)
  await expect.poll(() => versions.find(version =>
    version.scriptURL.includes('background.js') && version.runningStatus === 'running')).toBeTruthy()
  const worker = versions.find(version => version.scriptURL.includes('background.js') && version.runningStatus === 'running')
  if (!worker) throw new Error('未观察到运行中的 uNAS Service Worker。')

  await cdp.send('ServiceWorker.stopWorker', { versionId: worker.versionId })
  await expect.poll(() => versions.find(version => version.versionId === worker.versionId)?.runningStatus).toBe('stopped')

  // A new runtime event must wake the worker; no in-memory state may be required for this rejection.
  await expect.poll(() => legacyLaunch(page)).toEqual(legacyLaunchRejection)
  await expect.poll(() => versions.find(version => version.versionId === worker.versionId)?.runningStatus).toBe('running')
  await cdp.send('ServiceWorker.disable')
  expect(extension.errors).toEqual([])
})
