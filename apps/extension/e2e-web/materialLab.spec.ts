import { test, expect } from '@playwright/test'

test('development material lab compares UniPass, the old uNAS material, and the Liquid Glass candidate', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/?material-lab=1')
  await expect(page.getByRole('heading', { name: 'Liquid Glass 材质对比' })).toBeVisible()
  await expect(page.locator('.mt-material-lab__glass')).toHaveCount(9)
  const materials = await page.locator('.mt-material-lab__glass').evaluateAll((cards) => cards.slice(0, 3).map((card) => {
    const style = getComputedStyle(card)
    return { className: card.className, background: style.background, backdropFilter: style.backdropFilter }
  }))
  expect(materials[0].backdropFilter).toContain('saturate(1.55)')
  expect(materials[1].background).toContain('0.88')
  expect(materials[2].backdropFilter).toContain('saturate(1.38)')
  await page.screenshot({ path: testInfo.outputPath('material-lab.png'), fullPage: true, animations: 'disabled' })
  await testInfo.attach('material-lab-computed-style', { body: JSON.stringify(materials, null, 2), contentType: 'application/json' })
})
