import { test, expect } from './fixtures'

test('native dialog and Popover preserve launcher and task-menu semantics', async ({ extension }) => {
  const page = await extension.context.newPage()
  await page.goto('chrome://newtab/')

  await page.getByRole('button', { name: '所有应用' }).click()
  const launcher = page.getByRole('dialog', { name: '应用启动器' })
  await expect(launcher).toBeVisible()
  await expect.poll(() => launcher.evaluate((element) => ({ tagName: element.tagName, open: (element as HTMLDialogElement).open }))).toEqual({ tagName: 'DIALOG', open: true })
  await page.keyboard.press('Escape')
  await expect(launcher).toBeHidden()

  await page.locator('.app-icon--fetcher').click()
  const downloader = page.locator('[data-app-id="fetcher"]')
  const row = downloader.locator('.dl-row').filter({ hasText: '模拟产品发布会回放' })
  const trigger = row.getByRole('button', { name: '更多操作' })
  await trigger.click()

  const menu = page.getByRole('menu', { name: '任务扩展操作' })
  await expect(menu).toBeVisible()
  await expect.poll(() => menu.evaluate((element) => ({ tagName: element.tagName, open: element.matches(':popover-open') }))).toEqual({ tagName: 'DIV', open: true })
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('ArrowDown')
  await expect(menu.getByRole('menuitem', { name: '复制链接' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')

  expect(extension.remoteRequests).toEqual([])
  expect(extension.errors).toEqual([])
})
