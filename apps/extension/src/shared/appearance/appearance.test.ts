import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

import { WALLPAPERS } from './appearance'

describe('wallpaper gradients', () => {
  it('uses perceptual interpolation and same-hue transparent stops in every sRGB and P3 wallpaper', () => {
    expect(WALLPAPERS).toHaveLength(6)
    for (const wallpaper of WALLPAPERS) {
      expect(wallpaper.gradientSrgb).toContain('in oklab')
      expect(wallpaper.gradientSrgb).toContain('rgb(')
      expect(wallpaper.gradientSrgb).not.toContain('transparent')
      expect(wallpaper.gradientP3).toContain('in oklab')
      expect(wallpaper.gradientP3).toContain('color(display-p3')
      expect(wallpaper.gradientP3).not.toContain('transparent')
    }
  })

  it('selects the P3 token only when the browser and output device support it', async () => {
    const stylesheet = await readFile(new URL('../styles/shell/sidebar-desktop.css', import.meta.url), 'utf8')

    expect(stylesheet).toContain('@supports (color: color(display-p3 1 1 1))')
    expect(stylesheet).toContain('@media (color-gamut: p3)')
    expect(stylesheet).toContain('--mt-wp: var(--mt-wp-p3)')
  })
})
describe('desktop application affordances', () => {
  it('keeps a consistent App silhouette and subtle navigation selection', async () => {
    const stylesheet = await readFile(new URL('../styles/shell/sidebar-desktop.css', import.meta.url), 'utf8')

    const icons = await readFile(new URL('../styles/app-icons.css', import.meta.url), 'utf8')
    expect(stylesheet).not.toContain('.app-icon--music')
    expect(icons).toMatch(/border-radius: 25%;/)
    expect(stylesheet).toMatch(/\.mt-left-nav__app-btn--active\s*\{[^}]*background: color-mix\(in srgb, var\(--window-accent\) 8%, transparent\);/)
    expect(stylesheet).toMatch(/\.sb-btn svg\s*\{[^}]*width: 17\.6px;[^}]*height: 17\.6px;/)
    expect(icons).toMatch(/\.app-icon-img--dock\s*\{[^}]*width: 32px;[^}]*height: 32px;/)
    expect(stylesheet).toMatch(/\.app-icon\s*\{[^}]*contain: layout;/)
    expect(stylesheet).not.toMatch(/\.app-icon\s*\{[^}]*contain: layout paint;/)
    expect(stylesheet).toMatch(/\.app-icon-label\s*\{[^}]*min-height: 20px;[^}]*line-height: 20px;/)
    expect(stylesheet).toMatch(/\.icon-grid\s*\{[^}]*grid-template-rows: repeat\(var\(--desktop-icon-rows\), max-content\);/)
    expect(icons).toMatch(/\.app-icon-img\s*\{[^}]*flex: 0 0 48px;/)
  })
})
