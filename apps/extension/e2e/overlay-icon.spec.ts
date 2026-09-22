import { test, expect } from './fixtures'

test('overlay AdBlock icon loads in an HTTPS closed shadow root', async ({ extension }, testInfo) => {
  const page = await extension.context.newPage()
  const url = 'https://overlay-icon.example.test/'
  await page.route(url, route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><title>Overlay icon fixture</title><body></body>',
  }))
  await page.goto(url)
  // Exercise the page resource boundary without requiring a real account or action gesture.
  const result = await page.evaluate(async (extensionId) => {
    const host = document.createElement('div')
    document.body.append(host)
    const shadow = host.attachShadow({ mode: 'closed' })
    const image = new Image(16, 16)
    image.src = `chrome-extension://${extensionId}/static/app/icons/default/adblock.svg`
    shadow.append(image)
    await image.decode()
    return { width: image.width, height: image.height, naturalWidth: image.naturalWidth }
  }, extension.extensionId)
  expect(result).toEqual({ width: 16, height: 16, naturalWidth: 64 })
  await testInfo.attach('loaded-icon', { body: await page.screenshot(), contentType: 'image/png' })
  expect(extension.errors).toEqual([])
})
