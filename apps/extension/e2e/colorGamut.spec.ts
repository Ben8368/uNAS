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
