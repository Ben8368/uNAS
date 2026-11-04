import { test, expect } from './fixtures'

const labels = ['添加 App', '文件管理', '下载', '密码管家', '广告拦截', '音乐解锁']

test('App icons share local artwork across desktop, launcher, Dock and window', async ({ extension }, testInfo) => {
  const page = await extension.context.newPage()
  await page.goto(`chrome-extension://${extension.extensionId}/newtab.html`)
  const desktop = page.getByRole('navigation', { name: '应用快捷方式' })
  await expect(desktop.getByRole('button')).toHaveCount(labels.length)
  for (const label of labels) await expect(desktop.getByRole('button', { name: label, exact: true })).toBeVisible()
  const desktopIcons = desktop.locator('img')
  await expect.poll(() => desktopIcons.evaluateAll((images) => images.every((image) => (image as HTMLImageElement).naturalWidth > 0))).toBe(true)
  const sources = await desktopIcons.evaluateAll((images) => images.map((image) => image.getAttribute('src')))
  expect(sources.every((src) => src?.startsWith('/static/app/icons/default/') && src.endsWith('.svg'))).toBe(true)
  await page.getByRole('button', { name: '所有应用', exact: true }).click()
  const launcher = page.getByRole('dialog', { name: '应用启动器' })
  expect(await launcher.locator('img').evaluateAll((images) => images.map((image) => image.getAttribute('src')))).toEqual(sources)
  await launcher.getByRole('searchbox', { name: '搜索应用' }).fill('音乐')
  await expect(launcher.getByRole('button')).toHaveCount(1)
  await launcher.getByRole('button', { name: '音乐解锁', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(launcher).not.toBeVisible()
  const app = page.locator('[data-app-id="music"]')
  await expect(app).toBeVisible()
  await expect(app.getByRole('heading', { name: '音乐解锁', exact: true })).toBeVisible()
  const dockIcon = page.getByRole('button', { name: '切换到音乐解锁', exact: true }).locator('img')
  await expect(dockIcon).toHaveAttribute('src', sources[5]!)
  await expect(dockIcon).toHaveCSS('width', '32px')
  await expect(app.locator('.mt-window-brand img')).toHaveAttribute('src', sources[5]!)
  await page.screenshot({ path: testInfo.outputPath('music-shared-icon-surfaces.png'), animations: 'disabled' })
  await app.getByRole('button', { name: '关闭音乐解锁', exact: true }).click()
  await expect(page.getByRole('button', { name: '所有应用', exact: true })).toBeFocused()
  expect(extension.errors).toEqual([])
})

test('App icons remain square and visible across viewport and accessibility states', async ({ extension }, testInfo) => {
  const page = await extension.context.newPage()
  await page.goto(`chrome-extension://${extension.extensionId}/newtab.html`)
  for (const width of [1440, 1100, 1099, 1024, 700, 699, 390]) {
    const height = width === 390 ? 844 : 900
    await page.setViewportSize({ width, height })
    const icons = page.locator('.icon-grid .app-icon-img')
    await expect(icons).toHaveCount(labels.length)
    for (let i = 0; i < labels.length; i++) {
      const icon = icons.nth(i)
      await expect(icon).toBeVisible()
      await expect(icon).toHaveCSS('width', '48px')
      await expect(icon).toHaveCSS('height', '48px')
      await expect(icon).toHaveCSS('border-radius', '25%')
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`desktop-${width}.png`), animations: 'disabled' })
  }
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' })
  const first = page.locator('.icon-grid button').first()
  await first.focus()
  await expect(first).toBeFocused()
  await expect(first.locator('img')).toHaveCSS('outline-style', 'solid')
  await page.screenshot({ path: testInfo.outputPath('desktop-forced-colors-focus.png'), animations: 'disabled' })
  await testInfo.attach('scope', { body: JSON.stringify({ viewports: 'CSS viewport emulation; not physical devices or actual browser zoom', theme: 'Product desktop remains fixed dark; no theme behavior changed', visualAcceptance: 'Requires maintainer review; screenshots are not aesthetic certification' }), contentType: 'application/json' })
  expect(extension.errors).toEqual([])
})

test('broken App artwork uses one local fallback without duplicate accessible labels', async ({ extension }) => {
  const page = await extension.context.newPage()
  let requests = 0
  await page.route('**/static/app/icons/default/music.svg', async (route) => { requests++; await route.abort() })
  await page.goto(`chrome-extension://${extension.extensionId}/newtab.html`)
  const music = page.getByRole('navigation', { name: '应用快捷方式' }).getByRole('button', { name: '音乐解锁', exact: true })
  const icon = music.locator('img')
  await expect(icon).toHaveAttribute('src', '/static/app/icons/default/app.svg')
  await expect(icon).toHaveAttribute('alt', '')
  await expect.poll(() => icon.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(64)
  expect(requests).toBe(1)
  await music.click()
  await expect(page.locator('[data-app-id="music"]').getByRole('heading', { name: '音乐解锁', exact: true })).toBeVisible()
  expect(extension.errors).toEqual([])
})
