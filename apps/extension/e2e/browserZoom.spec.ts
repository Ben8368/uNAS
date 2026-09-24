import { test, expect } from './fixtures'

test('actual 200-percent browser zoom keeps App controls reachable', async ({ extension }, testInfo) => {
  const page = await extension.context.newPage()
  await page.goto('chrome-extension://' + extension.extensionId + '/newtab.html')
  await page.locator('.app-icon--fetcher').click()
  const initial = await page.evaluate(async () => {
    const tab = await browser.tabs.getCurrent()
    if (tab?.id == null) throw new Error('Missing extension tab')
    return { id: tab.id, zoom: await browser.tabs.getZoom(tab.id), width: innerWidth, dpr: devicePixelRatio }
  })
  try {
    await page.evaluate(async id => browser.tabs.setZoom(id, 2), initial.id)
    await expect.poll(() => page.evaluate(() => innerWidth)).toBe(Math.round(initial.width * initial.zoom / 2))
    expect(await page.evaluate(async id => browser.tabs.getZoom(id), initial.id)).toBe(2)
    const app = page.locator('[data-app-id="fetcher"]')
    const add = app.getByRole('button', { name: '添加任务', exact: true })
    await add.focus()
    await page.keyboard.press('Enter')
    await expect(app.getByRole('button', { name: '提交下载任务', exact: true })).toBeVisible()
    const rect = await app.boundingBox()
    const actual = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio }))
    expect(rect!.x).toBeGreaterThanOrEqual(0)
    expect(rect!.y).toBeGreaterThanOrEqual(0)
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(actual.width + 1)
    expect(rect!.y + rect!.height).toBeLessThanOrEqual(actual.height + 1)
    await page.screenshot({ path: testInfo.outputPath('actual-browser-zoom-200.png'), animations: 'disabled' })
    await app.getByLabel('下载链接', { exact: true }).fill('https://example.test/zoom-probe.zip')
    const submit = app.getByRole('button', { name: '提交下载任务', exact: true })
    await submit.scrollIntoViewIfNeeded()
    await submit.focus()
    await expect(submit).toBeFocused()
    expect(await submit.evaluate(element => {
      const bounds = element.getBoundingClientRect()
      return bounds.top >= 0 && bounds.bottom <= innerHeight && element.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2))
    })).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('actual-browser-zoom-200-submit.png'), animations: 'disabled' })
    await testInfo.attach('actual-browser-zoom', { body: JSON.stringify({ initial, actual, rect, zoom: 2, evidence: 'tabs.setZoom changes actual browser page zoom; not a viewport simulation or manual toolbar gesture.' }, null, 2), contentType: 'application/json' })
  } finally { await page.evaluate(async value => browser.tabs.setZoom(value.id, value.zoom), initial) }
  expect(extension.errors).toEqual([])
})
