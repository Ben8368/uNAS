import { test as base, expect, chromium, type BrowserContext, type Page } from '@playwright/test'
import { existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

type Extension = { context: BrowserContext; extensionId: string; errors: string[]; remoteRequests: string[] }
export const test = base.extend<{ extension: Extension }>({
  extension: async ({}, use, testInfo) => {
    const extensionPath = path.resolve('.output/chrome-mv3')
    if (!existsSync(path.join(extensionPath, 'manifest.json'))) throw new Error('先运行 pnpm build:extension；E2E 必须加载真实 MV3 构建物。')
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium', headless: true,
      viewport: { width: 1440, height: 900 },
      // Allow CDP to trigger the toolbar action in this disposable test profile only.
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--enable-unsafe-extension-debugging'],
    })
    context.setDefaultTimeout(10_000)
    context.setDefaultNavigationTimeout(15_000)
    const errors: string[] = []
    const remoteRequests: string[] = []
    const watch = (page: Page) => page.on('pageerror', (error) => errors.push(error.message))
    context.pages().forEach(watch)
    context.on('page', watch)
    context.on('request', (request) => { if (/^https?:/.test(request.url())) remoteRequests.push(request.url()) })
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true })
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker')
    const extensionId = new URL(worker.url()).hostname
    const environmentPath = testInfo.outputPath('environment.json')
    writeFileSync(environmentPath, JSON.stringify({ browser: context.browser()?.version(), os: `${os.platform()} ${os.release()} ${os.arch()}`, extensionPath, extensionId, headless: true, viewport: { width: 1440, height: 900 }, evidence: 'Unpacked MV3 in bundled Chromium; not installed system Chrome certification.' }, null, 2))
    await testInfo.attach('environment', { path: environmentPath, contentType: 'application/json' })
    try { await use({ context, extensionId, errors, remoteRequests }) }
    finally {
      const observationsPath = testInfo.outputPath('runtime-observations.json')
      writeFileSync(observationsPath, JSON.stringify({ errors, remoteRequests }, null, 2))
      await testInfo.attach('runtime-observations', { path: observationsPath, contentType: 'application/json' })
      if (testInfo.status !== testInfo.expectedStatus) await context.tracing.stop({ path: testInfo.outputPath('trace.zip') })
      else await context.tracing.stop()
      await context.close()
    }
  },
})
export { expect }

export async function revealRuntimePanel(page: Page) {
  const trigger = page.getByRole('button', { name: '显示运行状态' })
  await expect(trigger).toBeVisible()
  await trigger.hover()
  await expect(page.getByLabel('预览控制')).toBeVisible()
}

export async function workspace(extension: Extension, appId: string) {
  const page = await extension.context.newPage()
  await page.goto(`chrome-extension://${extension.extensionId}/workspace.html#${appId}`)
  await revealRuntimePanel(page)
  await expect(page.getByRole('combobox', { name: '模拟场景' })).toBeVisible()
  await expect(page.locator(`[data-app-id="${appId}"]`)).toBeVisible()
  return page
}

export async function openApp(page: Page, appId: string) {
  await page.evaluate((id) => {
    if (location.hash === `#${id}`) location.hash = ''
    location.hash = id
  }, appId)
  await expect(page.locator(`[data-app-id="${appId}"]`)).toBeVisible()
  return page.locator(`[data-app-id="${appId}"]`)
}

export async function closeApp(page: Page, appId: string) {
  await page.locator(`[data-app-id="${appId}"] .mt-window-controls`).getByRole('button', { name: /^关闭/ }).click()
  await expect(page.locator(`[data-app-id="${appId}"]`)).toHaveCount(0)
}
