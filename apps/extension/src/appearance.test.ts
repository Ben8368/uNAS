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
