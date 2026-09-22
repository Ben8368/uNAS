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
    const stylesheet = await readFile(new URL('./styles/shell/sidebar-desktop.css', import.meta.url), 'utf8')

    expect(stylesheet).toContain('@supports (color: color(display-p3 1 1 1))')
    expect(stylesheet).toContain('@media (color-gamut: p3)')
    expect(stylesheet).toContain('--mt-wp: var(--mt-wp-p3)')
  })
})
describe('desktop application affordances', () => {
  it('uses a circular visual and focus container for Music Unlock while keeping its navigation selection subtle', async () => {
    const stylesheet = await readFile(new URL('./styles/shell/sidebar-desktop.css', import.meta.url), 'utf8')

    expect(stylesheet).toMatch(/\.app-icon--music \.app-icon-img\s*\{\s*border-radius: 50%;\s*\}/)
    expect(stylesheet).toMatch(/\.mt-left-nav__app-btn--active\s*\{[^}]*background: color-mix\(in srgb, var\(--window-accent\) 12%, transparent\);/)
  })
})

describe('App icon brightness', () => {
  it('keeps the SVG palette close to AdBlock luminance with readable white glyphs', async () => {
    const names = ['adblock', 'browser', 'download', 'files', 'media', 'layers', 'settings', 'logs', 'image', 'document', 'archive', 'tasks']
    const luminances = await Promise.all(names.map(async name => {
      const svg = await readFile(new URL('../public/static/app/icons/default/' + name + '.svg', import.meta.url), 'utf8')
      const hex = svg.match(/<rect[^>]+fill="(#[a-f0-9]{6})"/)![1]
      const channels = hex.slice(1).match(/../g)!.map(value => {
        const channel = parseInt(value, 16) / 255
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
      })
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
    }))
    for (const [index, luminance] of luminances.entries()) {
      expect(luminance).toBeGreaterThan(luminances[0] * 0.7)
      expect(luminance).toBeLessThan(luminances[0] * 1.15)
      // AdBlock is the unchanged reference; newly adjusted icons keep >= 3:1.
      if (index > 0) expect(1.05 / (luminance + 0.05)).toBeGreaterThanOrEqual(3)
    }
  })
})
