import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'
import { WALLPAPERS } from 'unas-src/appearance'

const startupDocuments = [
  new URL('../index.html', import.meta.url),
  new URL('../entrypoints/newtab/index.html', import.meta.url),
  new URL('../entrypoints/workspace/index.html', import.meta.url),
]

describe('startup documents', () => {
  it('pre-paints the saved desktop appearance without a text loading screen', async () => {
    const [documents, startupScript] = await Promise.all([
      Promise.all(startupDocuments.map((document) => readFile(document, 'utf8'))),
      readFile(new URL('../public/startupAppearance.js', import.meta.url), 'utf8'),
    ])

    for (const document of documents) {
      expect(document).toContain('<div id="root"></div>')
      expect(document).toContain('background-image: var(--mt-wp)')
      expect(document).toContain('<script src="/startupAppearance.js"></script>')
      expect(document).not.toContain('正在启动 uNAS Demo')
    }

    expect(startupScript).toContain("localStorage.getItem('unas.appearance.v1')")
    expect(startupScript).toContain("root.style.setProperty('--mt-wp-srgb', wallpapers[wallpaper].srgb)")
    expect(startupScript).toContain("root.style.setProperty('--mt-wp-p3', wallpapers[wallpaper].p3)")
    expect(startupScript).toContain('color(display-p3')
    for (const wallpaper of WALLPAPERS) {
      expect(wallpaper.gradientSrgb).toContain('in oklab')
      expect(wallpaper.gradientP3).toContain('color(display-p3')
    }
  })
})
