import { test, expect, chromium } from '@playwright/test'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { extensionBrowserOptions } from './browserLaunch'

type Manifest = { version: string }

function nextVersion(version: string) {
  const parts = version.split('.').map(Number)
  if (parts.length !== 3 || parts.some(part => !Number.isInteger(part) || part < 0)) throw new Error(`无法为扩展更新验证递增版本：${version}`)
  parts[2] += 1
  return parts.join('.')
}

function insideTempDirectory(target: string) {
  const root = path.resolve(os.tmpdir())
  return path.resolve(target).startsWith(`${root}${path.sep}`)
}

async function clickExtensionsControl(page: import('@playwright/test').Page, selector: string) {
  await page.evaluate((target) => {
    const find = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector(target)
      if (direct) return direct
      for (const element of root.querySelectorAll('*')) {
        if (element.shadowRoot) {
          const nested = find(element.shadowRoot)
          if (nested) return nested
        }
      }
      return null
    }
    const control = find(document)
    if (!(control instanceof HTMLElement)) throw new Error(`扩展管理控件不可用：${target}`)
    control.click()
  }, selector)
}

test('unpacked extension reload accepts a newer manifest and preserves Link Apps', async ({}, testInfo) => {
  const sourcePath = path.resolve('.output/chrome-mv3')
  if (!existsSync(path.join(sourcePath, 'manifest.json'))) throw new Error('先运行 pnpm build:extension；E2E 必须加载真实 MV3 构建物。')

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'unas-update-'))
  if (!insideTempDirectory(tempRoot)) throw new Error('更新验证临时目录不在系统临时路径内。')
  const extensionPath = path.join(tempRoot, 'extension')
  const profilePath = path.join(tempRoot, 'profile')
  const manifestPath = path.join(extensionPath, 'manifest.json')
  await cp(sourcePath, extensionPath, { recursive: true })

  let context: Awaited<ReturnType<typeof chromium.launchPersistentContext>> | undefined
  const pageErrors: string[] = []
  try {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest
    const updatedVersion = nextVersion(manifest.version)
    context = await chromium.launchPersistentContext(profilePath, extensionBrowserOptions(extensionPath))
    context.setDefaultTimeout(10_000)
    context.on('page', page => page.on('pageerror', error => pageErrors.push(error.message)))
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker')
    const extensionId = new URL(worker.url()).hostname
    const before = await context.newPage()
    await before.goto(`chrome-extension://${extensionId}/newtab.html`)
    expect(await before.evaluate(() => browser.runtime.getManifest().version)).toBe(manifest.version)
    await before.locator('.app-icon--browser').click()
    const browserApp = before.locator('[data-app-id="browser"]')
    await browserApp.getByLabel('名称', { exact: true }).fill('Update proof')
    await browserApp.getByLabel('选择网址', { exact: true }).fill('https://update.example/path')
    await browserApp.getByRole('button', { name: '添加 App', exact: true }).click()

    await writeFile(manifestPath, JSON.stringify({ ...manifest, version: updatedVersion }), 'utf8')
    const extensionsPage = await context.newPage()
    await extensionsPage.goto('chrome://extensions/')
    await extensionsPage.locator('extensions-manager').waitFor()
    await clickExtensionsControl(extensionsPage, '#devMode')
    await clickExtensionsControl(extensionsPage, '#dev-reload-button')

    const after = await context.newPage()
    await expect.poll(async () => {
      try {
        await after.goto(`chrome-extension://${extensionId}/newtab.html`, { waitUntil: 'domcontentloaded', timeout: 2_000 })
        return await after.evaluate(() => browser.runtime.getManifest().version)
      } catch {
        return undefined
      }
    }).toBe(updatedVersion)
    await after.locator('.app-icon--browser').click()
    await expect(after.locator('[data-app-id="browser"] li')).toContainText('https://update.example/path')
    expect(pageErrors).toEqual([])
    await testInfo.attach('environment', {
      body: JSON.stringify({
        browser: context.browser()?.version(),
        extensionId,
        sourceVersion: manifest.version,
        updatedVersion,
        profile: 'isolated temporary profile',
        evidence: 'A copied unpacked extension was version-bumped in place, then reloaded through chrome://extensions. This is not a Chrome Web Store update or real task recovery evidence.',
      }, null, 2),
      contentType: 'application/json',
    })
  } finally {
    await context?.close().catch(() => undefined)
    await rm(tempRoot, { recursive: true, force: true })
  }
})
