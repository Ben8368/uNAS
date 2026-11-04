import { writeFile } from 'node:fs/promises'
import { test, expect } from './fixtures'

for (const width of [1440, 1024, 390]) {
  test(`palette evidence and geometry: ${width}`, async ({ extension }, testInfo) => {
    const page = await extension.context.newPage()
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    await page.goto(`chrome-extension://${extension.extensionId}/newtab.html`)
    const desktop = page.getByRole('navigation', { name: '应用快捷方式' })
    await expect(desktop.getByRole('button', { name: '下载', exact: true })).toBeVisible()
    await expect.poll(() => desktop.locator('img').evaluateAll(images => images.every(image => (image as HTMLImageElement).naturalWidth > 0))).toBe(true)
    const geometry: Record<string, unknown> = {}
    const capture = async (surface: string) => {
      geometry[surface] = await page.locator('.mt-left-nav, .app-icon, .mt-window, .mt-window-header, .dl-sidebar, .dl-panel, .mt-launcher, .launcher-app').evaluateAll(elements => elements.filter(element => element.getClientRects().length > 0).map(element => {
        const { x, y, width, height } = element.getBoundingClientRect()
        return { className: element.className, x, y, width, height }
      }))
      await page.screenshot({ path: testInfo.outputPath(`${surface}-${width}.png`), animations: 'disabled' })
    }
    await capture('desktop')
    await desktop.getByRole('button', { name: '下载', exact: true }).click()
    const app = page.locator('[data-app-id="fetcher"]')
    await expect(app.getByRole('button', { name: '添加任务', exact: true })).toBeVisible()
    await capture('download')
    await app.getByRole('button', { name: '添加任务', exact: true }).click()
    await expect(app.getByRole('button', { name: '提交下载任务', exact: true })).toBeVisible()
    await capture('download-form')
    await app.getByRole('button', { name: '关闭下载', exact: true }).click()
    await page.getByRole('button', { name: '所有应用', exact: true }).click()
    const launcher = page.getByRole('dialog', { name: '应用启动器' })
    await expect(launcher).toBeVisible()
    await expect(launcher.getByRole('searchbox')).toBeFocused()
    await capture('launcher')
    await page.keyboard.press('Escape')
    await expect(launcher).not.toBeVisible()
    const geometryPath = testInfo.outputPath('geometry.json')
    await writeFile(geometryPath, JSON.stringify(geometry, null, 2))
    await testInfo.attach('geometry', { path: geometryPath, contentType: 'application/json' })
    await testInfo.attach('palette', { body: await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement)
      return JSON.stringify(Object.fromEntries(['--window-background', '--window-surface-raised', '--window-primary', '--window-accent', '--window-text', '--window-text-muted'].map(name => [name, style.getPropertyValue(name).trim()])), null, 2)
    }), contentType: 'application/json' })
    expect(extension.errors).toEqual([])
  })
}
