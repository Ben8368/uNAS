import { test, expect } from './fixtures'

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

    const openOverlay = async () => worker.evaluate(async ({ id, token }) => {
      const [marker] = await chrome.scripting.executeScript({
        target: { tabId: id },
        func: (key: string, value: string) => { (globalThis as Record<string, unknown>)[key] = value },
        args: ['__unas_unipass_overlay_token__', token],
      })
      if (!marker?.documentId) throw new Error('Overlay fixture document was not found.')
      await chrome.storage.session.set({ 'unipass-overlay-tokens-v1': { [String(id)]: { token, documentId: marker.documentId } } })
      await chrome.scripting.executeScript({ target: { tabId: id }, files: ['page-overlay.js'] })
    }, { id: tabId, token: `e2e-overlay-${Date.now()}-${Math.random()}` })

    await openOverlay()
    await expect(page.locator('#unipass-page-overlay')).toHaveCount(1)
    await page.locator('#unipass-page-overlay').screenshot({ path: testInfo.outputPath('unipass-original-overlay.png') })
    const overlayBox = await page.locator('#unipass-page-overlay').boundingBox()
    if (!overlayBox) throw new Error('Overlay fixture bounds were not found.')
    // Theme toggle is the middle header control in the retained popup layout.
    await page.mouse.click(overlayBox.x + overlayBox.width - 64, overlayBox.y + 32)
    await page.locator('#unipass-page-overlay').screenshot({ path: testInfo.outputPath('unipass-alternate-theme.png') })
    await page.emulateMedia({ contrast: 'more', reducedMotion: 'reduce' })
    await page.locator('#unipass-page-overlay').screenshot({ path: testInfo.outputPath('unipass-reduced-effects.png') })
    await page.emulateMedia({ contrast: 'no-preference', reducedMotion: 'no-preference' })
    // The overlay intentionally uses a closed Shadow DOM. Click the visible
    // tab by its rendered geometry and retain a visual artifact instead of
    // weakening that isolation with page-level DOM selectors.
    await page.mouse.click(overlayBox.x + overlayBox.width * 0.75, overlayBox.y + 78)
    await page.locator('#unipass-page-overlay').screenshot({ path: testInfo.outputPath('unipass-apps-overlay.png') })

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
    await openOverlay()
    await expect(page.locator('#unipass-page-overlay')).toHaveCount(1)
    await page.mouse.click(5, 5)
    await expect(page.locator('#unipass-page-overlay')).toHaveCount(0)

    await page.reload()
    await expect(page.locator('#unipass-page-overlay')).toHaveCount(0)
    await expect.poll(() => page.url()).toBe(loginUrl)
    expect(extension.errors).toEqual([])
  } finally {
    await extension.context.unroute(loginUrl)
  }
})
