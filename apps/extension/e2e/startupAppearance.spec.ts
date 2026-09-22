import { test, expect } from './fixtures'

for (const legacyTheme of ['light', 'system']) {
test(`New Tab ignores legacy ${legacyTheme} and pre-paints the saved wallpaper before React mounts`, async ({ extension }) => {
  const page = await extension.context.newPage()
  await page.emulateMedia({ colorScheme: 'light' })
  await page.addInitScript((themeMode) => {
    localStorage.setItem('unas.appearance.v1', JSON.stringify({
      schemaVersion: 1,
      themeMode,
      wallpaper: 3,
      reduceMotion: false,
      reduceTransparency: false,
      highContrast: false,
    }))
  }, legacyTheme)

  let releaseBootstrap!: () => void
  const bootstrapReady = new Promise<void>((resolve) => { releaseBootstrap = resolve })
  await page.route('**/chunks/extensionPageBootstrap-*.js', async (route) => {
    await bootstrapReady
    await route.continue()
  })

  await page.goto(`chrome-extension://${extension.extensionId}/newtab.html`, { waitUntil: 'commit' })
  await expect.poll(() => page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    colorScheme: document.documentElement.style.colorScheme,
    desktopMounted: document.querySelector('.mt-desktop') !== null,
    wallpaperSrgb: document.documentElement.style.getPropertyValue('--mt-wp-srgb'),
    wallpaperP3: document.documentElement.style.getPropertyValue('--mt-wp-p3'),
  }))).toEqual({
    theme: 'dark',
    colorScheme: 'dark',
    desktopMounted: false,
    wallpaperSrgb: expect.stringContaining('148 117 68'),
    wallpaperP3: expect.stringContaining('color(display-p3'),
  })

  releaseBootstrap()
  await expect(page.getByRole('navigation', { name: '应用快捷方式' })).toBeVisible()
  await expect(page.getByRole('button', { name: '所有应用' })).not.toBeFocused()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(extension.errors).toEqual([])
})
}
