import { test, expect, workspace } from './fixtures'

test('Settings reports the current display color gamut', async ({ extension }) => {
  const page = await workspace(extension, 'fetcher')
  await page.getByRole('button', { name: '设置', exact: true }).click()

  const settings = page.locator('[data-app-id="settings"]')
  const expected = await page.evaluate(() => matchMedia('(color-gamut: p3)').matches ? 'P3' : 'sRGB')
  const status = settings.locator('.mt-window-color-gamut')

  await expect(status).toHaveText(expected)
  await expect(status).toHaveAttribute('aria-label', `当前显示色域：${expected}`)
  expect(extension.errors).toEqual([])
})
