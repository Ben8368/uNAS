import { test, expect } from './fixtures'

test('runtime errors leave the mounted desktop and drafts intact', async ({ extension }) => {
  const page = await extension.context.newPage()
  await page.goto(`chrome-extension://${extension.extensionId}/newtab.html`)
  await page.locator('.app-icon--browser').click()
  const name = page.getByLabel('名称', { exact: true })
  await name.fill('Unsaved draft')
  await page.evaluate(() => {
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('runtime test'), message: 'runtime test' }))
    window.dispatchEvent(new PromiseRejectionEvent('unhandledrejection', { promise: Promise.resolve(), reason: new Error('runtime rejection test') }))
  })
  await expect(name).toHaveValue('Unsaved draft')
  await expect(page.getByRole('navigation', { name: '应用快捷方式' })).toBeVisible()
  await expect(page.getByText('uNAS Demo 启动失败', { exact: true })).toHaveCount(0)
})

test('a failed main module still displays a readable startup error', async ({ extension }) => {
  const page = await extension.context.newPage()
  await page.addInitScript(() => sessionStorage.setItem = () => { throw new Error('storage unavailable') })
  await page.route('**/chunks/main-*.js', (route) => route.abort())
  await page.goto(`chrome-extension://${extension.extensionId}/newtab.html`)
  await expect(page.getByRole('heading', { name: 'uNAS Demo 启动失败' })).toBeVisible()
  await expect(page.locator('pre')).not.toBeEmpty()
})
