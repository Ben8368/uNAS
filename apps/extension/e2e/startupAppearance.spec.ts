import { test, expect } from './fixtures'

test('New Tab pre-paints the saved wallpaper before React mounts', async ({ extension }) => {
  const page = await extension.context.newPage()
  await page.addInitScript(() => {
    localStorage.setItem('unas.appearance.v1', JSON.stringify({
      schemaVersion: 1,
      themeMode: 'dark',
      wallpaper: 3,
      reduceMotion: false,
      reduceTransparency: false,
      highContrast: false,
    }))
  })

  let releaseBootstrap!: () => void
  const bootstrapReady = new Promise<void>((resolve) => { releaseBootstrap = resolve })
  await page.route('**/chunks/extensionPageBootstrap-*.js', async (route) => {
    await bootstrapReady
    await route.continue()
  })

  await page.goto(`chrome-extension://${extension.extensionId}/newtab.html`, { waitUntil: 'commit' })
  await expect.poll(() => page.evaluate(() => ({
    desktopMounted: document.querySelector('.mt-desktop') !== null,
    wallpaperSrgb: document.documentElement.style.getPropertyValue('--mt-wp-srgb'),
    wallpaperP3: document.documentElement.style.getPropertyValue('--mt-wp-p3'),
  }))).toEqual({
    desktopMounted: false,
    wallpaperSrgb: expect.stringContaining('148 117 68'),
    wallpaperP3: expect.stringContaining('color(display-p3'),
  })

  releaseBootstrap()
  await expect(page.getByRole('navigation', { name: '应用快捷方式' })).toBeVisible()
  expect(extension.errors).toEqual([])
})
