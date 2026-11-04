import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { WALLPAPERS } from './appearance'

const theme = readFileSync(new URL('../styles/window-theme.css', import.meta.url), 'utf8')
const dark = theme.split(":root[data-theme-scope='overlay']")[0]
const light = theme.split(":root[data-theme-scope='overlay'][data-theme='light']")[1].split('/* Glass has')[0]
const token = (source: string, name: string) => source.match(new RegExp('--window-' + name + ': (#[a-f0-9]{6});'))?.[1] ?? ''
function luminance(hex: string) {
  const channels = hex.slice(1).match(/../g)!.map(value => {
    const channel = parseInt(value, 16) / 255
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4
  })
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (values[0] + .05) / (values[1] + .05)
}

describe('graphite and sage palette', () => {
  it.each([['desktop', dark], ['light overlay', light]])('keeps readable text and controls on opaque surfaces: %s', (_, source) => {
    const surfaces = ['background', 'surface', 'surface-content', 'surface-raised-solid', 'surface-control-solid', 'surface-field-solid', 'surface-panel-solid']
    for (const background of surfaces) {
      for (const foreground of ['text', 'text-muted', 'accent', 'danger', 'success', 'warning']) {
        expect(contrast(token(source, foreground), token(source, background)), foreground + ' on ' + background).toBeGreaterThanOrEqual(4.5)
      }
      expect(contrast(token(source, 'focus-ring'), token(source, background))).toBeGreaterThanOrEqual(3)
    }
    expect(contrast(token(dark, 'on-primary'), token(dark, 'primary'))).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps the desktop surfaces neutral rather than blue or teal', () => {
    for (const name of ['background', 'surface', 'surface-raised-solid', 'surface-control-solid', 'surface-field-solid', 'surface-panel-solid']) {
      const rgb = token(dark, name).slice(1).match(/../g)!.map(channel => parseInt(channel, 16))
      expect(Math.max(...rgb) - Math.min(...rgb)).toBeLessThanOrEqual(16)
    }
  })

  it.each([0, 1, 2, 3, 4, 5])('prepaints exactly the same palette as React for wallpaper %s', (wallpaper) => {
    const properties = new Map<string, string>()
    const root = { className: '', dataset: {}, style: { colorScheme: '', setProperty: (name: string, value: string) => properties.set(name, value) } }
    const startup = readFileSync(new URL('../../../public/startupAppearance.js', import.meta.url), 'utf8')
    runInNewContext(startup, {
      document: { documentElement: root },
      localStorage: { getItem: () => JSON.stringify({ schemaVersion: 1, wallpaper }) },
    })
    expect(properties.get('--mt-wp-srgb')).toBe(WALLPAPERS[wallpaper].gradientSrgb)
    expect(properties.get('--mt-wp-p3')).toBe(WALLPAPERS[wallpaper].gradientP3)
    expect(root.dataset).toEqual({ theme: 'dark' })
  })
})
