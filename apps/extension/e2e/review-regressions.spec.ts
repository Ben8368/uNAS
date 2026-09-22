import { test, expect } from './fixtures'
import { checkWindowDraftAndFocus } from './windowChecks'

test('minimized Apps retain drafts and focus follows the visible window', async ({ extension }) => {
  const page = await extension.context.newPage()
  await page.goto(`chrome-extension://${extension.extensionId}/newtab.html`)
  await checkWindowDraftAndFocus(page)
  expect(extension.errors).toEqual([])
})

test('runtime panel shows health score and omits GPU capability details and simulated task summary', async ({ extension }) => {
  const tab = await extension.context.newPage()
  await tab.goto(`chrome-extension://${extension.extensionId}/newtab.html`)
  await tab.locator('.rp-edge-trigger').click()
  await expect(tab.locator('.rp-uptime')).toContainText('系统运行')
  await expect(tab.locator('.rp-uptime')).not.toContainText('估算')
  await expect(tab.locator('.rp-uptime > span').first()).toHaveText('系统运行')
  await expect(tab.locator('.rp-uptime-value strong')).toBeVisible()
  await expect(tab.getByText('网速状态', { exact: true })).toHaveCount(0)
  await expect(tab.getByRole('img', { name: /^健康:/ })).toHaveCount(1)
  await expect(tab.getByRole('img', { name: /^GPU:/ })).toHaveCount(0)
  await expect(tab.locator('.rp-gauge[title]')).toHaveCount(0)
  await expect(tab.getByRole('region', { name: 'Workspace 任务摘要' })).toHaveCount(0)
  await expect(tab.getByText('模拟任务摘要', { exact: true })).toHaveCount(0)
  await expect(tab.locator('.rp-capability-note')).toHaveCount(0)
  expect(extension.errors).toEqual([])
  expect(extension.remoteRequests).toEqual([])
})
