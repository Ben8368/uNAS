import { test, expect } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { checkWindowDraftAndFocus } from '../e2e/windowChecks'

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
      if (app) {
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
