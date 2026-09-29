import { test, expect } from './fixtures'

for (const tracked of [false, true]) {
  test('browser download projection, polling and removal: tracked=' + tracked, async ({ extension }, testInfo) => {
    const page = await extension.context.newPage()
    await page.goto('chrome-extension://' + extension.extensionId + '/newtab.html')
    await page.locator('.app-icon--fetcher').waitFor()
    // Synthetic boundary response only: no network transfer or user downloads.
    await page.evaluate((tracked) => {
      const state = { gets: 0, cancels: 0, forgets: 0, complete: false }
      Object.assign(globalThis, { downloadProbe: state })
      const runtime = browser.runtime
      const original = runtime.sendMessage.bind(runtime)
      runtime.sendMessage = (async (message: { kind?: string }) => {
        if (message.kind === 'browser.download') return { ok: true, downloadId: 42, ...(tracked ? {} : { trackingWarning: 'Chrome 已启动下载，但 uNAS 未能保存记录。' }) }
        if (message.kind === 'browser.download.list') return { ok: true, downloads: [] }
        if (message.kind === 'browser.download.get') {
          state.gets++
          return { ok: true, ...(tracked ? { download: { id: 42, state: state.complete ? 'complete' : 'in_progress', bytesReceived: state.complete ? 10 : 5, totalBytes: 10 } } : {}) }
        }
        if (message.kind === 'browser.download.cancel') { state.cancels++; return { ok: false, error: 'must not cancel' } }
        if (message.kind === 'browser.download.forget') { state.forgets++; return { ok: false, error: 'storage unavailable' } }
        return original(message)
      }) as typeof runtime.sendMessage
    }, tracked)
    await page.locator('.app-icon--fetcher').click()
    const app = page.locator('[data-app-id="fetcher"]')
    await app.getByRole('button', { name: '添加任务', exact: true }).click()
    await app.getByLabel('下载链接', { exact: true }).fill('https://example.test/tracking-probe.zip')
    await app.getByRole('button', { name: '提交下载任务', exact: true }).click()
    const row = app.locator('.dl-row').filter({ hasText: 'tracking-probe.zip' })
    await expect(row).toBeVisible()
    const probe = () => page.evaluate(() => (globalThis as unknown as { downloadProbe: { gets: number; cancels: number; forgets: number } }).downloadProbe)
    if (!tracked) {
      await expect(row).toContainText('状态未知')
      await expect(row.locator('.dl-progress-bar')).toHaveCount(0)
      await expect(app.getByRole('button', { name: 'stop-selected-downloads', exact: true })).toBeDisabled()
      await expect(app.getByRole('button', { name: 'retry-selected-downloads', exact: true })).toBeDisabled()
      // Observe longer than a polling interval; untracked records must never poll.
      await page.waitForTimeout(2200)
      expect((await probe()).gets).toBe(0)
      await page.screenshot({ path: testInfo.outputPath('untracked-download.png'), animations: 'disabled' })
      await app.getByRole('button', { name: 'delete-download-records', exact: true }).click()
      await expect(row).toHaveCount(0)
      expect(await probe()).toMatchObject({ cancels: 0, forgets: 0 })
      await expect(app.locator('.dl-action-error')).toContainText(['未能保存记录', '移除列表记录'])
    } else {
      await expect(row).toContainText('50.0%')
      await page.waitForTimeout(2200)
      expect((await probe()).gets).toBeGreaterThanOrEqual(2)
      expect((await probe()).gets).toBeLessThanOrEqual(3)
      await page.evaluate(() => { (globalThis as unknown as { downloadProbe: { complete: boolean } }).downloadProbe.complete = true })
      await expect(row).toContainText('100.0%')
      const completedGets = (await probe()).gets
      await page.waitForTimeout(2200)
      expect((await probe()).gets).toBe(completedGets)
    }
    expect(extension.errors).toEqual([])
  })
}

for (const mode of ['missing', 'error', 'restore'] as const) {
  test(`browser download stops polling and remains removable after ${mode}`, async ({ extension }) => {
    const page = await extension.context.newPage()
    await page.goto(`chrome-extension://${extension.extensionId}/newtab.html`)
    await page.locator('.app-icon--fetcher').waitFor()
    await page.evaluate(mode => {
      const state = { gets: 0, forgets: 0 }
      Object.assign(globalThis, { lostDownloadProbe: state })
      const runtime = browser.runtime
      const original = runtime.sendMessage.bind(runtime)
      runtime.sendMessage = (async (message: { kind?: string }) => {
        if (message.kind === 'browser.download') return { ok: true, downloadId: 42 }
        if (message.kind === 'browser.download.list') return { ok: true, downloads: mode === 'restore' ? [{ downloadId: 42, url: 'https://example.test/lost.zip', createdAt: Date.now() }] : [] }
        if (message.kind === 'browser.download.get') {
          state.gets++
          return mode === 'error' ? { ok: false, error: 'synthetic query failure' } : { ok: true }
        }
        if (message.kind === 'browser.download.forget') { state.forgets++; return { ok: true } }
        return original(message)
      }) as typeof runtime.sendMessage
    }, mode)
    await page.locator('.app-icon--fetcher').click()
    const app = page.locator('[data-app-id="fetcher"]')
    if (mode !== 'restore') {
      await app.getByRole('button', { name: '添加任务', exact: true }).click()
      await app.getByLabel('下载链接', { exact: true }).fill('https://example.test/lost.zip')
      await app.getByRole('button', { name: '提交下载任务', exact: true }).click()
    }
    const row = app.locator('.dl-row').filter({ hasText: 'lost.zip' })
    await expect(row).toContainText('状态未知')
    if (mode === 'restore') await row.click()
    const gets = await page.evaluate(() => (globalThis as any).lostDownloadProbe.gets)
    await page.waitForTimeout(2200)
    expect(await page.evaluate(() => (globalThis as any).lostDownloadProbe.gets)).toBe(gets)
    expect(gets).toBe(mode === 'error' ? 3 : 1)
    await app.getByRole('button', { name: 'delete-download-records', exact: true }).click()
    await expect(row).toHaveCount(0)
    expect(await page.evaluate(() => (globalThis as any).lostDownloadProbe.forgets)).toBe(1)
    expect(extension.errors).toEqual([])
  })
}

test('recheck resumes an existing download after transient errors with a fresh retry budget', async ({ extension }) => {
  const page = await extension.context.newPage()
  await page.goto(`chrome-extension://${extension.extensionId}/newtab.html`)
  await page.locator('.app-icon--fetcher').waitFor()
  await page.evaluate(() => {
    const state = { gets: 0, starts: 0, outcome: 'error' }
    Object.assign(globalThis, { recheckProbe: state })
    const runtime = browser.runtime
    const original = runtime.sendMessage.bind(runtime)
    runtime.sendMessage = (async (message: { kind?: string }) => {
      if (message.kind === 'browser.download') { state.starts++; return { ok: true, downloadId: 42 } }
      if (message.kind === 'browser.download.list') return { ok: true, downloads: [] }
      if (message.kind === 'browser.download.get') {
        state.gets++
        if (state.outcome === 'error') return { ok: false, error: 'synthetic unavailable' }
        return { ok: true, download: { id: 42, state: state.outcome, bytesReceived: 5, totalBytes: 10 } }
      }
      return original(message)
    }) as typeof runtime.sendMessage
  })
  await page.locator('.app-icon--fetcher').click()
  const app = page.locator('[data-app-id="fetcher"]')
  await app.getByRole('button', { name: '添加任务', exact: true }).click()
  await app.getByLabel('下载链接', { exact: true }).fill('https://example.test/recheck.zip')
  await app.getByRole('button', { name: '提交下载任务', exact: true }).click()
  const row = app.locator('.dl-row').filter({ hasText: 'recheck.zip' })
  const probe = () => page.evaluate(() => (globalThis as any).recheckProbe as { gets: number; starts: number })
  const recheck = async () => {
    await row.locator('.dl-row-menu-trigger').click()
    await page.getByRole('menuitem', { name: '重新检查', exact: true }).click()
  }
  await expect(row).toContainText('状态未知')
  expect((await probe()).gets).toBe(3)
  await recheck()
  await expect.poll(async () => (await probe()).gets).toBe(6)
  await expect(row).toContainText('状态未知')
  await page.evaluate(() => { (globalThis as any).recheckProbe.outcome = 'in_progress' })
  await recheck()
  await expect(row).toContainText('50.0%')
  await page.evaluate(() => { (globalThis as any).recheckProbe.outcome = 'complete' })
  await expect(row).toContainText('100.0%')
  expect((await probe()).starts).toBe(1)
  expect(extension.errors).toEqual([])
})
