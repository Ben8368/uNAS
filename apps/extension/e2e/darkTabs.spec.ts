import { test, expect } from './fixtures'

for (const entry of ['newtab.html', 'workspace.html#settings']) {
  test(entry + ' stays dark with legacy light preferences and a light OS', async ({ extension }, testInfo) => {
    const page = await extension.context.newPage()
    await page.emulateMedia({ colorScheme: 'light' })
    await page.addInitScript(() => localStorage.setItem('unas.appearance.v1', JSON.stringify({ schemaVersion: 1, themeMode: 'light', wallpaper: 2 })))
    await page.goto('chrome-extension://' + extension.extensionId + '/' + entry)
    await expect(page.getByRole('navigation', { name: '应用快捷方式' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')
    expect(await page.locator('html').evaluate(root => getComputedStyle(root).getPropertyValue('--window-text').trim())).toBe('#f1f3f5')
    const icons = page.locator('.icon-grid img')
    for (const image of await icons.all()) expect(await image.evaluate(element => (element as HTMLImageElement).complete && (element as HTMLImageElement).naturalWidth > 0)).toBe(true)
    if (entry.startsWith('newtab')) {
      await page.screenshot({ path: testInfo.outputPath('bright-desktop.png'), animations: 'disabled' })
      await page.getByRole('button', { name: '所有应用' }).click()
      await expect(page.getByRole('dialog', { name: '应用启动器' })).toBeVisible()
      await page.screenshot({ path: testInfo.outputPath('bright-launcher.png'), animations: 'disabled' })
      await page.keyboard.press('Escape')
    }
    await page.getByRole('button', { name: '设置', exact: true }).click()
    const settings = page.locator('[data-app-id="settings"]')
    await expect(settings.getByRole('combobox', { name: '主题', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: /^切换外观/ }).click()
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('unas.appearance.v1')!))).not.toHaveProperty('themeMode')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.getByRole('navigation', { name: '应用快捷方式' })).toBeVisible()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({ path: testInfo.outputPath('compact-dark.png'), animations: 'disabled' })
    expect(extension.errors).toEqual([])
  })
}
