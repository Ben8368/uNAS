import { test, expect, closeApp } from './fixtures'

test('广告拦截桌面入口、共享窗口与真实状态', async ({ extension }, testInfo) => {
  const page = await extension.context.newPage()
  await page.goto('chrome-extension://' + extension.extensionId + '/newtab.html')
  const pagesBefore = extension.context.pages().length
  await page.locator('.app-icon--adblock').click()
  const app = page.locator('[data-app-id="adblock"]')
  await expect(app.getByRole('heading', { name: '拦截概览' })).toBeVisible()
  await expect(app.getByText('来源：扩展实时状态。关闭此窗口不会关闭广告拦截。')).toBeVisible()
  const initial = await app.boundingBox()
  expect(initial!.width).toBe(960)
  expect(initial!.height).toBe(640)
  await app.getByRole('button', { name: '检查更新' }).click()
  await expect(app.getByRole('button', { name: '检查更新' })).toBeEnabled()
  await app.locator('.mt-window-controls').getByRole('button', { name: /^最小化/ }).click()
  await page.locator('.app-icon--adblock').click()
  await expect(app).toHaveCount(1)
  await expect(app).toBeVisible()
  expect(extension.context.pages().length).toBe(pagesBefore)
  for (const size of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size)
    for (const theme of ['light', 'dark']) {
      await page.evaluate(value => { document.documentElement.dataset.theme = value }, theme)
      await expect(app.getByRole('button', { name: '检查更新' })).toBeInViewport()
      expect(await app.locator('.adblock-app').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath('adblock-' + size.width + '-' + theme + '.png'), animations: 'disabled' })
    }
  }
  await page.evaluate(() => {
    document.documentElement.dataset.reduceTransparency = 'true'
    document.documentElement.dataset.highContrast = 'true'
  })
  expect(await app.evaluate(el => getComputedStyle(el).backdropFilter)).toBe('none')
  await closeApp(page, 'adblock')
  await expect(page.getByRole('button', { name: '所有应用', exact: true })).toBeFocused()
  await page.getByRole('button', { name: '所有应用', exact: true }).click()
  await page.getByRole('dialog', { name: '应用启动器' }).getByRole('button', { name: '广告拦截 广告拦截', exact: true }).click()
  await expect(app.getByRole('heading', { name: '拦截概览' })).toBeVisible()
  expect(extension.errors).toEqual([])
})
