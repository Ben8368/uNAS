import { test, expect, workspace } from './fixtures'

const cases = [
  { name: 'wide-dark', width: 1440, height: 900, theme: 'dark' as const },
  { name: 'regular-dark', width: 1024, height: 768, theme: 'dark' as const },
  { name: 'compact-dark', width: 390, height: 844, theme: 'dark' as const },
  { name: 'wide-light', width: 1440, height: 900, theme: 'light' as const },
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
    await settings.getByRole('combobox', { name: /主题/ }).selectOption(sample.theme)
    await settings.getByRole('button', { name: '关闭设置', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', sample.theme)
    if (sample.reducedMotion) await expect(page.locator('html')).toHaveAttribute('data-reduce-motion', 'true')
    if (sample.highContrast) await expect(page.locator('html')).toHaveAttribute('data-high-contrast', 'true')
    const app = page.locator('[data-app-id="fetcher"]')
    const submitButton = app.getByRole('button', { name: '添加任务', exact: true })
    await submitButton.focus()
    await page.keyboard.press('Enter')
    await expect(app.getByRole('button', { name: /^(添加模拟任务|确认添加)$/ })).toBeVisible()
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

for (const appId of ['fetcher', 'file-manager']) {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
    test(`existing App layout: ${appId} ${viewport.width}`, async ({ extension }, testInfo) => {
      const page = await workspace(extension, appId)
      await page.setViewportSize(viewport)
      const app = page.locator(`[data-app-id="${appId}"]`)
      if (appId === 'file-manager') await expect(app.locator('.fm-address')).toHaveText('/Workspace')
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
