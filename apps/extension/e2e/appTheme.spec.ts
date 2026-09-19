import { test, expect, workspace } from './fixtures'

for (const appId of ['fetcher', 'settings', 'logs', 'file-manager']) {
  test(`App-owned theme states: ${appId}`, async ({ extension }, testInfo) => {
    const page = appId === 'settings' || appId === 'logs' ? await extension.context.newPage() : await workspace(extension, appId)
    if (appId === 'settings' || appId === 'logs') {
      await page.goto(`chrome-extension://${extension.extensionId}/newtab.html`)
      await page.getByRole('button', { name: appId === 'settings' ? '设置' : '演示日志', exact: true }).click()
    }
    const app = page.locator(`[data-app-id="${appId}"]`)
    if (appId === 'fetcher') await app.getByRole('button', { name: '添加任务', exact: true }).click()
    for (const theme of ['dark', 'light'] as const) {
      await page.evaluate((theme) => {
        document.documentElement.dataset.theme = theme
        document.documentElement.dataset.highContrast = 'false'
        document.documentElement.dataset.reduceTransparency = 'false'
      }, theme)
      await page.setViewportSize({ width: 1440, height: 900 })
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
      if (colors.sidebar) expect(colors.sidebar).toContain('linear-gradient')
      const focusable = app.locator('button:not(:disabled):visible, select:visible, input:visible').first()
      await focusable.focus()
      await page.keyboard.press('Tab')
      await page.keyboard.press('Shift+Tab')
      await expect(focusable).toBeFocused()
      expect(await focusable.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none')
      await page.screenshot({ path: testInfo.outputPath(`${appId}-${theme}.png`), animations: 'disabled' })
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
