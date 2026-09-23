import { test, expect, workspace } from './fixtures'

const cases = [
  { name: 'wide-dark', width: 1440, height: 900, theme: 'dark' as const },
  { name: 'regular-dark', width: 1024, height: 768, theme: 'dark' as const },
  { name: 'compact-dark', width: 390, height: 844, theme: 'dark' as const },
  { name: 'light-system-dark-tab', width: 1440, height: 900, theme: 'light' as const },
  { name: 'reduced-motion', width: 1440, height: 900, theme: 'dark' as const, reducedMotion: true },
  { name: 'high-contrast', width: 1024, height: 768, theme: 'dark' as const, highContrast: true },
  { name: '200-percent-layout-simulation', width: 720, height: 450, theme: 'dark' as const },
]

for (const sample of cases) {
  test(`layout evidence: ${sample.name}`, async ({ extension }, testInfo) => {
    const page = await workspace(extension, 'fetcher')
    await page.setViewportSize({ width: sample.width, height: sample.height })
    await page.emulateMedia({ colorScheme: sample.theme, reducedMotion: sample.reducedMotion ? 'reduce' : 'no-preference', contrast: sample.highContrast ? 'more' : 'no-preference' })
    await page.getByRole('button', { name: '设置', exact: true }).click()
    const settings = page.locator('[data-app-id="settings"]')
    await expect(settings.getByRole('combobox', { name: /主题/ })).toHaveCount(0)
    await settings.getByRole('button', { name: '关闭设置', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    if (sample.reducedMotion) await expect(page.locator('html')).toHaveAttribute('data-reduce-motion', 'true')
    if (sample.highContrast) await expect(page.locator('html')).toHaveAttribute('data-high-contrast', 'true')
    const app = page.locator('[data-app-id="fetcher"]')
    const submitButton = app.getByRole('button', { name: '添加任务', exact: true })
    await submitButton.focus()
    await page.keyboard.press('Enter')
    await expect(app.getByRole('button', { name: /^(提交下载任务|确认提交)$/ })).toBeVisible()
    const bounds = await app.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.y).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(sample.width + 1)
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(sample.height + 1)
    await testInfo.attach(`${sample.name}-layout`, {
      body: JSON.stringify({ ...sample, bounds, zoomEvidence: sample.name.startsWith('200') ? '720×450 CSS viewport models content area at 200% on 1440×900. Not actual browser zoom; true zoom requires separate manual acceptance.' : 'Browser CSS viewport emulation', visualJudgment: 'Screenshot evidence; no automated claim of aesthetic acceptance.' }, null, 2),
      contentType: 'application/json',
    })
    const screenshotPath = testInfo.outputPath(`${sample.name}.png`)
    await page.screenshot({ path: screenshotPath, fullPage: true, animations: 'disabled' })
    await testInfo.attach(sample.name, { path: screenshotPath, contentType: 'image/png' })
    expect(extension.errors).toEqual([])
  })
}

test('desktop App labels retain their full line box at 200-percent layout simulation', async ({ extension }) => {
  const page = await extension.context.newPage()
  await page.goto(`chrome-extension://${extension.extensionId}/newtab.html`)
  await page.setViewportSize({ width: 720, height: 450 })

  const label = page.locator('.app-icon--password-manager .app-icon-label')
  const icon = page.locator('.app-icon--password-manager .app-icon-img')
  const firstApp = page.locator('.app-icon--browser')
  const lastApp = page.locator('.app-icon--music')
  await expect(label).toBeVisible()
  await expect(icon).toBeVisible()
  const metrics = await label.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      clientHeight: element.clientHeight,
      lineHeight: Number.parseFloat(style.lineHeight),
      overflow: style.overflow,
    }
  })

  expect(metrics.overflow).toBe('hidden')
  expect(metrics.lineHeight).toBeGreaterThanOrEqual(20)
  expect(metrics.clientHeight).toBeGreaterThanOrEqual(metrics.lineHeight)
  const iconBounds = await icon.boundingBox()
  expect(iconBounds?.width).toBeGreaterThanOrEqual(48)
  expect(iconBounds?.height).toBeGreaterThanOrEqual(48)
  expect(Math.abs((iconBounds?.width || 0) - (iconBounds?.height || 0))).toBeLessThanOrEqual(1)
  const [firstBounds, lastBounds] = await Promise.all([firstApp.boundingBox(), lastApp.boundingBox()])
  expect(lastBounds?.x).toBeGreaterThan(firstBounds?.x || 0)
  expect(extension.errors).toEqual([])
})

for (const appId of ['fetcher', 'file-manager', 'browser']) {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
    test(`existing App layout: ${appId} ${viewport.width}`, async ({ extension }, testInfo) => {
      const page = appId === 'browser'
        ? await extension.context.newPage()
        : await workspace(extension, appId)
      if (appId === 'browser') {
        await page.goto(`chrome-extension://${extension.extensionId}/newtab.html`)
        await page.locator('.app-icon--browser').click()
      }
      await page.setViewportSize(viewport)
      const app = page.locator(`[data-app-id="${appId}"]`)
      if (appId === 'file-manager') await expect(app.getByRole('heading', { name: '打开本地目录' })).toBeVisible()
      if (appId === 'fetcher') await app.getByRole('button', { name: '添加任务', exact: true }).click()
      const bounds = await app.boundingBox()
      expect(bounds!.x).toBeGreaterThanOrEqual(0)
      expect(bounds!.y).toBeGreaterThanOrEqual(0)
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1)
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + 1)
      const screenshotPath = testInfo.outputPath(`${appId}-${viewport.width}.png`)
      await page.screenshot({ path: screenshotPath, animations: 'disabled' })
      await testInfo.attach('app-layout', { path: screenshotPath, contentType: 'image/png' })
      expect(extension.errors).toEqual([])
    })
  }
}
