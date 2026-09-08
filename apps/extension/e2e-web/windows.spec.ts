import { test, expect } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { checkWindowDraftAndFocus } from '../e2e/windowChecks'

test('runtime errors do not replace the Web desktop or erase a draft', async ({ page }) => {
  await page.goto('/')
  await page.locator('.app-icon--browser').click()
  const name = page.getByLabel('名称', { exact: true })
  await name.fill('Unsaved Web draft')
  await page.evaluate(() => {
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('runtime test'), message: 'runtime test' }))
    window.dispatchEvent(new PromiseRejectionEvent('unhandledrejection', { promise: Promise.resolve(), reason: new Error('runtime rejection test') }))
  })
  await expect(name).toHaveValue('Unsaved Web draft')
  await expect(page.getByRole('navigation', { name: '应用快捷方式' })).toBeVisible()
})

test('Web StrictMode Workspace acquires ownership, preserves drafts and restores focus', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/?surface=workspace')
  await expect(page.locator('.app-icon--browser')).toBeVisible()
  await checkWindowDraftAndFocus(page)
  await page.locator('.app-icon--browser').click()
  await page.getByLabel('名称', { exact: true }).fill('保留编辑焦点')
  await page.getByRole('button', { name: '所有应用' }).click()
  await page.getByRole('dialog', { name: '应用启动器' }).getByRole('button', { name: '文件管理' }).click()
  await expect(page.locator('[data-app-id="file-manager"]')).toBeFocused()
  await expect(page.locator('.mt-window--active')).toHaveAttribute('data-app-id', 'file-manager')
  expect(errors).toEqual([])
})

test('cold App launch paints final bounds and an explicit loading surface', async ({ page }, testInfo) => {
  let release!: () => void
  const ready = new Promise<void>((resolve) => { release = resolve })
  await page.route('**/src/apps/BrowserApp.tsx', async (route) => { await ready; await route.continue() })
  await page.goto('/')
  await page.evaluate(() => {
    const frames: { x: number; y: number; width: number; height: number; empty: boolean }[] = []
    Object.assign(window, { launchFrames: frames, stopLaunchFrames: false })
    const sample = () => {
      const app = document.querySelector('[data-app-id="browser"]')
      if (app && getComputedStyle(app).visibility !== 'hidden') {
        const rect = app.getBoundingClientRect()
        frames.push({ x: rect.x, y: rect.y, width: rect.width, height: rect.height, empty: !app.querySelector('.mt-window-body')?.textContent?.trim() })
      }
      if (!(window as unknown as { stopLaunchFrames: boolean }).stopLaunchFrames) requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
  try {
    await page.locator('.app-icon--browser').click()
    await expect(page.getByRole('status')).toContainText('正在打开添加 App')
  } finally { release() }
  await expect(page.getByLabel('名称', { exact: true })).toBeVisible()
  const frames = await page.evaluate(async () => {
    await new Promise(requestAnimationFrame)
    const state = window as unknown as { stopLaunchFrames: boolean; launchFrames: { x: number; y: number; width: number; height: number; empty: boolean }[] }
    state.stopLaunchFrames = true
    return state.launchFrames
  })
  expect(frames.length).toBeGreaterThan(0)
  expect(frames.every((frame) => !frame.empty)).toBe(true)
  expect(new Set(frames.map(({ x, y, width, height }) => JSON.stringify({ x, y, width, height }))).size).toBe(1)
  const evidencePath = testInfo.outputPath('launch-frames.json')
  writeFileSync(evidencePath, JSON.stringify({ browser: page.context().browser()?.version(), frames }, null, 2))
  await testInfo.attach('launch-frames', { path: evidencePath, contentType: 'application/json' })
  await page.screenshot({ path: testInfo.outputPath('web-app-open.png') })
})

test('fast lazy load reveals content and chrome together', async ({ page }) => {
  let release!: () => void
  const ready = new Promise<void>(resolve => { release = resolve })
  await page.route('**/src/apps/BrowserApp.tsx', async route => { await ready; await route.continue() })
  await page.goto('/')
  await expect(page.locator('.app-icon--browser')).toBeVisible()
  await page.clock.install()
  await page.clock.pauseAt(new Date())
  // DOM click avoids auto-waiting for animation frames while the test clock is paused.
  await page.locator('.app-icon--browser').dispatchEvent('click')
  const app = page.locator('[data-app-id="browser"]')
  try {
    await expect(app).toHaveAttribute('data-launch-pending', 'true')
    await expect(app).toBeHidden()
  } finally { release() }
  await expect(page.getByLabel('名称', { exact: true })).toBeVisible()
  await expect(app).toBeFocused()
  await expect(app.locator('.mt-app-loading')).toHaveCount(0)
  await page.clock.resume()
})

test('closing a slow launch does not reopen it when the module arrives', async ({ page }) => {
  let release!: () => void
  const ready = new Promise<void>(resolve => { release = resolve })
  await page.route('**/src/apps/BrowserApp.tsx', async route => { await ready; await route.continue() })
  await page.goto('/')
  await page.locator('.app-icon--browser').click()
  try {
    await expect(page.getByRole('status')).toContainText('正在打开添加 App')
    await page.getByRole('button', { name: '关闭添加 App', exact: true }).click()
  } finally { release() }
  await expect(page.locator('[data-app-id="browser"]')).toHaveCount(0)
  await page.locator('.app-icon--browser').click()
  await expect(page.getByLabel('名称', { exact: true })).toBeVisible()
  await expect(page.locator('[data-app-id="browser"]')).toHaveCount(1)
})

test('a rejected lazy load reveals a readable error instead of a hidden window', async ({ page }) => {
  // Exercise the error UI rather than the existing one-shot stale-chunk reload.
  await page.addInitScript(() => { sessionStorage.setItem = () => { throw new Error('storage unavailable') } })
  await page.route('**/src/apps/BrowserApp.tsx', route => route.abort())
  await page.goto('/')
  await page.locator('.app-icon--browser').click()
  await expect(page.getByRole('alert')).toContainText('应用资源加载失败')
  await expect(page.getByRole('button', { name: '重新加载桌面' })).toBeVisible()
  await page.getByRole('button', { name: '关闭添加 App', exact: true }).click()
  await expect(page.locator('[data-app-id="browser"]')).toHaveCount(0)
})
