import { writeFileSync } from 'node:fs'
import { test, expect, workspace, revealRuntimePanel } from './fixtures'

test('browsing default fixtures does not block closing a Workspace', async ({ extension }) => {
  const page = await workspace(extension, 'fetcher')
  await page.locator('.dl-row').first().click()
  const dialogs: string[] = []
  page.on('dialog', async dialog => { dialogs.push(dialog.type()); await dialog.dismiss() })
  await page.close({ runBeforeUnload: true })
  await expect.poll(() => page.isClosed()).toBe(true)
  expect(dialogs).toEqual([])
})

test('user tasks protect the page until canceled, without canceling on dismissed leave', async ({ extension }) => {
  const page = await workspace(extension, 'fetcher')
  const app = page.locator('[data-app-id="fetcher"]')
  await app.getByRole('button', { name: '添加任务', exact: true }).click()
  await app.getByLabel('模拟来源链接').fill('https://example.com/close-protection')
  await app.getByRole('button', { name: '添加模拟任务', exact: true }).click()
  const row = app.locator('.dl-row').filter({ hasText: 'example.com' })
  await expect(row).toContainText('12.0%')
  const dialogs: string[] = []
  page.on('dialog', async dialog => { dialogs.push(dialog.type()); await dialog.dismiss() })
  await page.close({ runBeforeUnload: true })
  await expect.poll(() => dialogs).toEqual(['beforeunload'])
  expect(page.isClosed()).toBe(false)
  await expect(row).toContainText('12.0%')
  await row.click()
  await app.getByRole('button', { name: 'stop-selected-downloads' }).click()
  await expect(row).toContainText('取消')
  await page.close({ runBeforeUnload: true })
  await expect.poll(() => page.isClosed()).toBe(true)
  expect(dialogs).toEqual(['beforeunload'])
  expect(extension.errors).toEqual([])
})

test('cold download launch never paints a false empty list or changing bounds', async ({ extension }, testInfo) => {
  const page = await extension.context.newPage()
  await page.goto(`chrome-extension://${extension.extensionId}/workspace.html`)
  await expect(page.locator('.app-icon--fetcher')).toBeVisible()
  await page.evaluate(() => {
    const frames: { loading: boolean; empty: boolean; bounds: number[] }[] = []
    Object.assign(window, { launchFrames: frames, stopLaunchFrames: false })
    const sample = () => {
      const app = document.querySelector('[data-app-id="fetcher"]')
      if (app && getComputedStyle(app).visibility !== 'hidden') {
        const rect = app.getBoundingClientRect()
        frames.push({ loading: !!app.querySelector('.mt-app-loading'), empty: !!app.querySelector('.dl-empty'), bounds: [rect.x, rect.y, rect.width, rect.height] })
      }
      if (!(window as unknown as { stopLaunchFrames: boolean }).stopLaunchFrames) requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
  await page.locator('.app-icon--fetcher').click()
  await expect(page.locator('.dl-row')).toContainText('模拟产品发布会回放')
  const frames = await page.evaluate(async () => {
    await new Promise(requestAnimationFrame)
    const state = window as unknown as { stopLaunchFrames: boolean; launchFrames: { loading: boolean; empty: boolean; bounds: number[] }[] }
    state.stopLaunchFrames = true
    return state.launchFrames
  })
  expect(frames.length).toBeGreaterThan(0)
  expect(frames.every(frame => !frame.empty)).toBe(true)
  expect(new Set(frames.map(frame => JSON.stringify(frame.bounds))).size).toBe(1)
  writeFileSync(testInfo.outputPath('launch-frames.json'), JSON.stringify(frames, null, 2))
  await page.screenshot({ path: testInfo.outputPath('download-first-render.png') })
  expect(extension.errors).toEqual([])
})

test('completed user work removes the leave guard', async ({ extension }) => {
  const page = await workspace(extension, 'fetcher')
  const app = page.locator('[data-app-id="fetcher"]')
  await app.getByRole('button', { name: '添加任务', exact: true }).click()
  await app.getByLabel('模拟来源链接').fill('https://example.com/completion')
  await app.getByRole('button', { name: '添加模拟任务', exact: true }).click()
  const row = app.locator('.dl-row').filter({ hasText: 'example.com' })
  await expect(row).toContainText('12.0%')
  await revealRuntimePanel(page)
  await page.getByRole('button', { name: '推进模拟步骤' }).click()
  await page.getByRole('button', { name: '推进模拟步骤' }).click()
  await expect(row).toContainText('100.0%')
  const dialogs: string[] = []
  page.on('dialog', async dialog => { dialogs.push(dialog.type()); await dialog.dismiss() })
  await page.close({ runBeforeUnload: true })
  await expect.poll(() => page.isClosed()).toBe(true)
  expect(dialogs).toEqual([])
})
