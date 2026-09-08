import { test, expect, chromium } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { existsSync } from 'node:fs'

test('browser restart preserves extension-local Link App configuration', async ({}, testInfo) => {
  const extensionPath = path.resolve('.output/chrome-mv3')
  if (!existsSync(path.join(extensionPath, 'manifest.json'))) throw new Error('先运行 pnpm build:extension；E2E 必须加载真实 MV3 构建物。')

  const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'unas-sp01-'))
  const tempRoot = path.resolve(os.tmpdir())
  const resolvedUserDataDir = path.resolve(userDataDir)
  if (!resolvedUserDataDir.startsWith(`${tempRoot}${path.sep}`)) throw new Error('测试 profile 路径不在临时目录内。')

  const launch = () => chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    viewport: { width: 1440, height: 900 },
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--enable-unsafe-extension-debugging',
    ],
  })

  let first: Awaited<ReturnType<typeof launch>> | undefined
  let second: Awaited<ReturnType<typeof launch>> | undefined
  const pageErrors: string[] = []
  try {
    first = await launch()
    first.setDefaultTimeout(10_000)
    first.on('page', page => page.on('pageerror', error => pageErrors.push(error.message)))
    const worker = first.serviceWorkers()[0] ?? await first.waitForEvent('serviceworker')
    const extensionId = new URL(worker.url()).hostname
    const page = await first.newPage()
    page.on('pageerror', error => pageErrors.push(error.message))
    await page.goto(`chrome-extension://${extensionId}/newtab.html`)
    await page.locator('.app-icon--browser').click()
    const app = page.locator('[data-app-id="browser"]')
    await app.getByLabel('名称', { exact: true }).fill('Restart proof')
    await app.getByLabel('选择网址', { exact: true }).fill('https://restart.example/path')
    await app.getByRole('button', { name: '添加 App', exact: true }).click()
    await expect(app.locator('li')).toContainText('https://restart.example/path')

    const firstBrowserVersion = first.browser()?.version()
    await first.close()
    first = undefined

    // Closing the persistent context terminates the browser process and the next
    // context reopens the same profile, exercising storage across a restart.
    second = await launch()
    second.setDefaultTimeout(10_000)
    second.on('page', page => page.on('pageerror', error => pageErrors.push(error.message)))
    const restartedWorker = second.serviceWorkers()[0] ?? await second.waitForEvent('serviceworker')
    const restartedExtensionId = new URL(restartedWorker.url()).hostname
    const restartedPage = await second.newPage()
    await restartedPage.goto(`chrome-extension://${restartedExtensionId}/newtab.html`)
    await restartedPage.locator('.app-icon--browser').click()
    await expect(restartedPage.locator('[data-app-id="browser"] li')).toContainText('https://restart.example/path')
    expect(pageErrors).toEqual([])
    await testInfo.attach('environment', {
      body: JSON.stringify({
        browser: second.browser()?.version() ?? firstBrowserVersion,
        extensionPath,
        profileRestarted: true,
        evidence: 'Two separate persistent Chromium contexts reused one profile; this is not system Chrome certification.',
      }, null, 2),
      contentType: 'application/json',
    })
  } finally {
    await second?.close().catch(() => undefined)
    await first?.close().catch(() => undefined)
    await rm(resolvedUserDataDir, { recursive: true, force: true })
  }
})
