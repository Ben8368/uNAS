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
    wallpaper: document.documentElement.style.getPropertyValue('--mt-wp'),
  }))).toEqual({ desktopMounted: false, wallpaper: expect.stringContaining('#947544') })

  releaseBootstrap()
  await expect(page.getByRole('navigation', { name: '应用快捷方式' })).toBeVisible()
  expect(extension.errors).toEqual([])
})
