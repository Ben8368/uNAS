import type { Page } from '@playwright/test'
import { test, expect, workspace } from './fixtures'

type MaterialSnapshot = {
  theme: 'dark' | 'light'
  reduceTransparency: boolean
  navigation: Record<string, string>
  window: Record<string, string>
  body: Record<string, string>
  launcher: Record<string, string>
}

async function applyAppearance(page: Page, theme: 'dark' | 'light', reduceTransparency = false) {
  await page.evaluate(({ theme, reduceTransparency }) => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.toggleAttribute('data-reduce-transparency', reduceTransparency)
    if (reduceTransparency) document.documentElement.setAttribute('data-reduce-transparency', 'true')
  }, { theme, reduceTransparency })
}

async function inspectMaterials(page: Page, theme: 'dark' | 'light', reduceTransparency: boolean): Promise<MaterialSnapshot> {
  return page.evaluate(({ theme, reduceTransparency }) => {
    const inspect = (selector: string) => {
      const computed = getComputedStyle(document.querySelector(selector)!)
      return {
        background: computed.background,
        backdropFilter: computed.backdropFilter,
        border: computed.border,
        boxShadow: computed.boxShadow,
      }
    }
    return {
      theme,
      reduceTransparency,
      navigation: inspect('.mt-left-nav'),
      window: inspect('.mt-window'),
      body: inspect('.mt-window-body'),
      launcher: inspect('.mt-launcher'),
    }
  }, { theme, reduceTransparency })
}

test('Liquid Glass refinement keeps environment transmission while the content surface stays readable', async ({ extension }, testInfo) => {
  const page = await workspace(extension, 'file-manager')
  await page.setViewportSize({ width: 1440, height: 900 })
  const evidence: MaterialSnapshot[] = []

  for (const theme of ['dark', 'light'] as const) {
    await applyAppearance(page, theme)
    evidence.push(await inspectMaterials(page, theme, false))
    await page.screenshot({ path: testInfo.outputPath(`refined-${theme}-files-and-dock.png`), animations: 'disabled' })
  }

  await applyAppearance(page, 'dark')
  await page.getByRole('button', { name: '所有应用' }).click()
  await expect(page.getByRole('dialog', { name: '应用启动器' })).toBeVisible()
  evidence.push(await inspectMaterials(page, 'dark', false))
  await page.screenshot({ path: testInfo.outputPath('refined-dark-launcher.png'), animations: 'disabled' })

  await page.getByRole('dialog', { name: '应用启动器' }).press('Escape')
  await applyAppearance(page, 'dark', true)
  evidence.push(await inspectMaterials(page, 'dark', true))
  await page.screenshot({ path: testInfo.outputPath('refined-reduced-transparency.png'), animations: 'disabled' })
  await testInfo.attach('refined-material-computed-style', {
    body: JSON.stringify(evidence, null, 2),
    contentType: 'application/json',
  })
  const dark = evidence.find((entry) => entry.theme === 'dark' && !entry.reduceTransparency)!
  const reduced = evidence.find((entry) => entry.reduceTransparency)!
  expect(dark.navigation.background).toContain('0.48')
  expect(dark.window.background).toContain('0.44')
  expect(dark.body.background).toContain('0.82')
  expect(dark.launcher.background).toContain('0.58')
  expect(dark.window.backdropFilter).toContain('saturate(1.38)')
  expect(reduced.window.backdropFilter).toBe('none')

  expect(extension.errors).toEqual([])
})

test('Browser App leaves the readable Liquid Glass surface exposed', async ({ extension }, testInfo) => {
  const page = await extension.context.newPage()
  await page.goto(`chrome-extension://${extension.extensionId}/newtab.html`)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.locator('.app-icon--browser').click()
  await expect(page.getByRole('heading', { name: '网址 App' })).toBeVisible()
  const surfaces = await page.evaluate(() => {
    const app = getComputedStyle(document.querySelector('.link-apps')!)
    const body = getComputedStyle(document.querySelector('.mt-window-body')!)
    return { appBackground: app.background, bodyBackground: body.background }
  })
  expect(surfaces.appBackground).toContain('rgba(0, 0, 0, 0)')
  expect(surfaces.bodyBackground).toContain('0.82')
  await page.screenshot({ path: testInfo.outputPath('refined-dark-browser-app.png'), animations: 'disabled' })
  await testInfo.attach('browser-app-surface-computed-style', {
    body: JSON.stringify(surfaces, null, 2),
    contentType: 'application/json',
  })
  expect(extension.errors).toEqual([])
})
