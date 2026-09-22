import { test, expect } from '@playwright/test'

test('广告拦截在 Web 预览中明确提示能力未接入', async ({ page }) => {
  await page.goto('/')
  await page.locator('.app-icon--adblock').click()
  const app = page.locator('[data-app-id="adblock"]')
  await expect(app.getByRole('heading', { name: '广告拦截能力未接入' })).toBeVisible()
  await expect(app.getByRole('button', { name: '检查更新' })).toBeDisabled()
  await expect(app.getByText('基础规则', { exact: true })).toHaveCount(0)
})
