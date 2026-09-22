import { test, expect, workspace } from './fixtures'

test('Settings reports the current display color gamut', async ({ extension }) => {
  const page = await workspace(extension, 'fetcher')
  await page.getByRole('button', { name: '设置', exact: true }).click()

  const settings = page.locator('[data-app-id="settings"]')
  const expected = await page.evaluate(() => matchMedia('(color-gamut: rec2020)').matches ? 'Rec. 2020' : matchMedia('(color-gamut: p3)').matches ? 'P3' : 'sRGB')
  const status = settings.locator('.mt-window-color-gamut')

  await expect(status).toHaveText(expected)
  await expect(status).toHaveAttribute('aria-label', `当前渲染色域：${expected}`)
  await expect(settings.getByText('可读性与动态效果', { exact: true })).toHaveCount(0)
  await expect(settings.locator('.settings-panel')).toHaveCSS('overflow-y', 'auto')
  expect(extension.errors).toEqual([])
})

test('Settings fills the window with one contour at desktop and compact sizes', async ({ extension }, testInfo) => {
  const page = await extension.context.newPage()
  await page.goto('chrome-extension://' + extension.extensionId + '/newtab.html')
  await page.getByRole('button', { name: '设置', exact: true }).click()
  const settings = page.locator('[data-app-id="settings"]')
  await expect(settings.locator('.settings-card')).toBeVisible()
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await expect.poll(() => settings.evaluate(root => {
      const panel = root.querySelector('.settings-panel')!.getBoundingClientRect()
      const card = root.querySelector('.settings-card')!.getBoundingClientRect()
      return Math.abs((card.left - panel.left) - (panel.right - card.right))
    })).toBeLessThanOrEqual(1)
    const contour = await settings.evaluate(root => ({
      border: getComputedStyle(root).borderTopWidth,
      rim: getComputedStyle(root, '::before').content,
      shadow: getComputedStyle(root).boxShadow,
    }))
    expect(contour.border).toBe('1px')
    expect(contour.rim).toBe('none')
    expect(contour.shadow).not.toMatch(/0px 0px 0px 1px/)
    await settings.screenshot({ path: testInfo.outputPath('settings-single-border-' + width + '.png'), animations: 'disabled' })
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await settings.getByRole('button', { name: '最大化设置', exact: true }).click()
  await expect(settings).toHaveCSS('box-shadow', 'none')
  await settings.screenshot({ path: testInfo.outputPath('settings-maximized.png'), animations: 'disabled' })
  expect(extension.errors).toEqual([])
})
