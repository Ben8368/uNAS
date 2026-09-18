import { test, expect } from './fixtures'

test('uNAS exposes the WebDAV password manager as a packaged extension page', async ({ extension }) => {
  const page = await extension.context.newPage()
  await page.goto(`chrome-extension://${extension.extensionId}/passwords.html`)
  await expect(page.locator('.app-window')).toBeVisible()
  await expect(page.getByRole('heading', { name: '当前页面账号' })).toBeVisible()
  const blocking = await page.evaluate(async () => {
    const response = await (globalThis as unknown as { browser: { runtime: { sendMessage: (message: unknown) => Promise<unknown> } } }).browser.runtime.sendMessage({ type: 'getBlockingStatus' }) as { ok: boolean; data?: { enabled?: boolean } }
    return response
  })
  expect(blocking.ok).toBe(true)
  expect(blocking.data?.enabled).toBe(true)
  expect(extension.errors).toEqual([])
})

test('the migrated UniPass overlay opens, fills, closes, and dies with an HTTPS page', async ({ extension }, testInfo) => {
  // Use an already-declared UniPass HTTPS host permission while intercepting
  // the response locally; this stays synthetic and never reaches the portal.
  const loginUrl = 'https://portal.unipass.top/synthetic-login'
  await extension.context.route(loginUrl, async (route) => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<!doctype html><html><body><main><h1>Synthetic HTTPS login</h1><form><input id="username" autocomplete="username"><input id="password" type="password" autocomplete="current-password"></form></main></body></html>',
  }))
  try {
    const page = await extension.context.newPage()
    await page.goto(loginUrl)
    await expect(page.getByRole('heading', { name: 'Synthetic HTTPS login' })).toBeVisible()
    const worker = extension.context.serviceWorkers()[0]
    if (!worker) throw new Error('uNAS Service Worker is not running.')
    const tabId = await worker.evaluate(async (url) => {
      const [tab] = await chrome.tabs.query({ url })
      if (tab?.id == null) throw new Error('Overlay fixture tab was not found.')
      return tab.id
    }, `${loginUrl}*`)

    await worker.evaluate(async (id) => {
      await chrome.scripting.executeScript({ target: { tabId: id }, files: ['page-overlay.js'] })
    }, tabId)
    await expect(page.locator('#unipass-page-overlay')).toHaveCount(1)
    await page.locator('#unipass-page-overlay').screenshot({ path: testInfo.outputPath('unipass-original-overlay.png') })

    await worker.evaluate(async (id) => {
      await chrome.scripting.executeScript({ target: { tabId: id }, files: ['content-script.js'] })
      const result = await chrome.tabs.sendMessage(id, {
        type: 'fillCredentials',
        credential: { username: 'synthetic-user', password: 'synthetic-password' },
        expectedAppUrl: 'https://portal.unipass.top/synthetic-login',
        mode: 'all',
      })
      if (!result?.ok) throw new Error(result?.error || 'Synthetic fill failed.')
    }, tabId)
    await expect(page.locator('#username')).toHaveValue('synthetic-user')
    await expect(page.locator('#password')).toHaveValue('synthetic-password')

    await page.keyboard.press('Escape')
    await expect(page.locator('#unipass-page-overlay')).toHaveCount(0)
    await worker.evaluate(async (id) => {
      await chrome.scripting.executeScript({ target: { tabId: id }, files: ['page-overlay.js'] })
    }, tabId)
    await expect(page.locator('#unipass-page-overlay')).toHaveCount(1)
    await page.mouse.click(5, 5)
    await expect(page.locator('#unipass-page-overlay')).toHaveCount(0)

    const unas = await extension.context.newPage()
    await unas.goto(`chrome-extension://${extension.extensionId}/passwords.html`)
    await expect(unas.locator('.app-window')).toBeVisible()
    await unas.screenshot({ path: testInfo.outputPath('unas-passwords-page.png'), fullPage: true })
    await page.reload()
    await expect(page.locator('#unipass-page-overlay')).toHaveCount(0)
    await expect.poll(() => page.url()).toBe(loginUrl)
    await expect(unas.locator('.app-window')).toBeVisible()
    expect(extension.errors).toEqual([])
  } finally {
    await extension.context.unroute(loginUrl)
  }
})
