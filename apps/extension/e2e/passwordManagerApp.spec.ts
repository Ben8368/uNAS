import { test, expect } from './fixtures'

test('密码管家桌面入口打开同一 Vault Core 的管理页', async ({ extension }) => {
  const page = await extension.context.newPage()
  await page.goto(`chrome-extension://${extension.extensionId}/newtab.html`)
  const app = page.locator('.app-icon--password-manager')
  await expect(app).toBeVisible()
  await app.click()
  const passwordManager = page.locator('[data-app-id="password-manager"]')
  await expect(passwordManager.getByRole('heading', { name: '密码管家' })).toBeVisible()
  await expect(passwordManager.getByText('未配置')).toBeVisible()

  const managePagePromise = extension.context.waitForEvent('page')
  await passwordManager.getByRole('button', { name: '打开密码管家管理页' }).click()
  const managePage = await managePagePromise
  await managePage.waitForLoadState('domcontentloaded')
  await expect(managePage).toHaveTitle('uNAS 密码管家')
  await expect(managePage.getByText('uNAS · 密码管家')).toBeVisible()
  await expect(managePage.getByRole('heading', { name: '连接 WebDAV' }).first()).toBeVisible()
  expect(extension.errors).toEqual([])
})
