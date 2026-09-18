import { createServer } from 'node:http'
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

test('the migrated page overlay artifact is present for the toolbar-triggered activeTab path', async ({ extension }) => {
  test.skip(true, 'Playwright headless cannot generate Chrome action.onClicked activeTab permission; run the manual toolbar smoke in Chrome for DOM/screenshot evidence.')
  expect(extension.context.serviceWorkers()).not.toHaveLength(0)
})

test.skip('the migrated page overlay artifact mounts in a real HTTP tab and toggles closed', async ({ extension }, testInfo) => {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    response.end('<!doctype html><html><body><h1>synthetic login page</h1><input autocomplete="username"><input type="password"></body></html>')
  })
  await new Promise<void>((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject))
  try {
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Overlay fixture did not bind a TCP port.')
    const page = await extension.context.newPage()
    await page.goto(`http://127.0.0.1:${address.port}/login`)
    const worker = extension.context.serviceWorkers()[0]
    if (!worker) throw new Error('uNAS Service Worker is not running.')
    const tabId = await worker.evaluate(async (url) => {
      const [tab] = await chrome.tabs.query({ url })
      if (tab?.id == null) throw new Error('Overlay fixture tab was not found.')
      return tab.id
    }, `http://127.0.0.1:${address.port}/*`)
    await worker.evaluate(async (id) => {
      await chrome.scripting.executeScript({ target: { tabId: id }, files: ['page-overlay.js'] })
    }, tabId)
    await expect(page.locator('#unipass-page-overlay')).toHaveCount(1)
    await page.screenshot({ path: testInfo.outputPath('unipass-overlay-empty.png'), fullPage: true })
    await worker.evaluate(async (id) => {
      await chrome.scripting.executeScript({ target: { tabId: id }, files: ['page-overlay.js'] })
    }, tabId)
    await expect(page.locator('#unipass-page-overlay')).toHaveCount(0)
    expect(extension.errors).toEqual([])
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})
