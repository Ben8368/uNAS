import { test, expect, workspace } from './fixtures'

for (const appId of ['fetcher', 'settings', 'logs', 'file-manager', 'music', 'browser', 'adblock']) {
  test(`App-owned theme states: ${appId}`, async ({ extension }, testInfo) => {
    const desktopLabels: Record<string, string> = { settings: '设置', logs: '演示日志', browser: '添加 App', adblock: '广告拦截' }
    const page = desktopLabels[appId] ? await extension.context.newPage() : await workspace(extension, appId)
    if (desktopLabels[appId]) {
      await page.goto(`chrome-extension://${extension.extensionId}/newtab.html`)
      if (appId === 'browser' || appId === 'adblock') await page.locator(`.app-icon--${appId}`).click()
      else await page.getByRole('button', { name: desktopLabels[appId], exact: true }).click()
    }
    await page.mouse.move(700, 20)
    const app = page.locator(`[data-app-id="${appId}"]`)
    if (appId === 'fetcher') await app.getByRole('button', { name: '添加任务', exact: true }).click()
    for (const theme of ['dark'] as const) {
      await page.evaluate((theme) => {
        document.documentElement.dataset.theme = theme
        document.documentElement.dataset.highContrast = 'false'
        document.documentElement.dataset.reduceTransparency = 'false'
      }, theme)
      await page.setViewportSize({ width: 1440, height: 900 })
      await expect(page.locator('.mt-left-nav')).toHaveCSS('width', '56px')
      await expect(page.locator('.mt-left-nav .sb-btn').first()).toHaveCSS('width', '48px')
      const navIconWidth = await page.locator('.mt-left-nav .sb-btn svg').first().evaluate((element) => Number.parseFloat(getComputedStyle(element).width))
      expect(navIconWidth).toBeCloseTo(17.6, 1)
      await expect(app.locator('.mt-window-body > *').first()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
      const colors = await app.evaluate((root) => {
        const select = root.querySelector('select')
        const title = root.querySelector('h2, h3')
        const sidebar = root.querySelector<HTMLElement>('.dl-sidebar, .fm-sidebar, .settings-sidebar')
        return {
          text: getComputedStyle(root).getPropertyValue('--window-text').trim(),
          title: title ? getComputedStyle(title).color : null,
          select: select ? getComputedStyle(select).color : null,
          sidebar: sidebar ? getComputedStyle(sidebar).backgroundImage : null,
        }
      })
      const expected = await app.evaluate((root) => {
        const probe = document.createElement('span')
        probe.style.color = 'var(--window-text)'
        root.append(probe)
        const color = getComputedStyle(probe).color
        probe.remove()
        return color
      })
      if (colors.title) expect(colors.title).toBe(expected)
      if (colors.select) expect(colors.select).toBe(expected)
      if (colors.sidebar) {
        if (appId === 'fetcher') expect(colors.sidebar).toBe('none')
        else expect(colors.sidebar).toContain('linear-gradient')
      }
      const focusable = app.locator('button:not(:disabled):visible, select:visible, input:visible').first()
      await focusable.focus()
      await page.keyboard.press('Tab')
      await page.keyboard.press('Shift+Tab')
      await expect(focusable).toBeFocused()
      expect(await focusable.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none')
      await page.screenshot({ path: testInfo.outputPath(`${appId}-${theme}.png`), animations: 'disabled' })
    }
    for (const viewport of [{ width: 1024, height: 768 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport)
      const bounds = await app.boundingBox()
      expect(bounds!.x).toBeGreaterThanOrEqual(0)
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1)
      await page.screenshot({ path: testInfo.outputPath(`${appId}-${viewport.width}.png`), animations: 'disabled' })
    }
    await page.setViewportSize({ width: 720, height: 600 })
    await page.evaluate(() => {
      document.documentElement.dataset.reduceTransparency = 'true'
      document.documentElement.dataset.highContrast = 'true'
    })
    const box = await app.boundingBox()
    expect(box!.x + box!.width).toBeLessThanOrEqual(721)
    expect(await app.evaluate(element => getComputedStyle(element).backdropFilter)).toBe('none')
    await page.screenshot({ path: testInfo.outputPath(`${appId}-compact-high-contrast.png`), animations: 'disabled' })
    expect(extension.errors).toEqual([])
  })
}

test('Downloader sidebar and task pane share one continuous material', async ({ extension }, testInfo) => {
  const page = await workspace(extension, 'fetcher')
  await page.mouse.move(700, 20)
  const app = page.locator('[data-app-id="fetcher"]')
  for (const theme of ['dark']) {
    for (const reduced of [false, true]) {
      await page.evaluate(({ theme, reduced }) => {
        document.documentElement.dataset.theme = theme
        document.documentElement.dataset.reduceTransparency = String(reduced)
      }, { theme, reduced })
      for (const selector of ['.dl-sidebar', '.dl-panel']) {
        await expect(app.locator(selector)).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
        await expect(app.locator(selector)).toHaveCSS('background-image', 'none')
        await expect(app.locator(selector)).toHaveCSS('backdrop-filter', 'none')
      }
      if (reduced) {
        await expect(app).toHaveCSS('backdrop-filter', 'none')
        await expect(app.locator('.mt-window-body')).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
      }
      await app.screenshot({ path: testInfo.outputPath('download-' + theme + '-' + (reduced ? 'opaque' : 'glass') + '.png'), animations: 'disabled' })
    }
  }
  expect(extension.errors).toEqual([])
})
