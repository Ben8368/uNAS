import { test, expect } from './fixtures'

test('toolbar action opens a new active uNAS desktop without navigating the current tab', async ({ extension }) => {
  const original = await extension.context.newPage()
  const worker = extension.context.serviceWorkers()[0]
  await expect.poll(() => worker.evaluate(() => {
    const api = (globalThis as unknown as { chrome: { action: { onClicked: { hasListeners(): boolean } } } }).chrome
    return api.action.onClicked.hasListeners()
  })).toBe(true)
  await original.goto('about:blank#toolbar-action')
  const browserCdp = await extension.context.browser()!.newBrowserCDPSession()
  const { targetInfos } = await browserCdp.send('Target.getTargets', { filter: [{ type: 'tab' }] })
  const targetInfo = targetInfos.find((target) => target.url === original.url())!
  expect(targetInfo).toBeDefined()
  for (let i = 0; i < 2; i++) {
    await original.bringToFront()
    const opened = extension.context.waitForEvent('page')
    void opened.catch(() => {})
    await browserCdp.send('Extensions.triggerAction', { id: extension.extensionId, targetId: targetInfo.targetId })
    const desktop = await opened
    await expect(desktop).toHaveURL(`chrome-extension://${extension.extensionId}/newtab.html`)
    await expect(desktop.getByRole('navigation', { name: '应用快捷方式' })).toBeVisible()
    await expect.poll(() => desktop.evaluate(() => document.visibilityState)).toBe('visible')
  }
  await expect(original).toHaveURL('about:blank#toolbar-action')
  expect(extension.errors).toEqual([])
  expect(extension.remoteRequests).toEqual([])
  await browserCdp.detach()
})
