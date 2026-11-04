import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { APP_ICON_PATHS, FALLBACK_ICON, getAppIcon } from './appIcons'

const paths = [...new Set([...Object.values(APP_ICON_PATHS), FALLBACK_ICON])]

describe('local App artwork', () => {
  it('resolves legacy aliases and rejects unknown or inherited object keys', () => {
    expect(getAppIcon('fileManager')).toBe(getAppIcon('file-manager'))
    for (const id of ['', 'missing', '__proto__', 'constructor', 'toString']) expect(getAppIcon(id)).toBe(FALLBACK_ICON)
  })

  it.each(paths)('ships a self-contained vector with matching provenance: %s', async (asset) => {
    const svg = await readFile(new URL('../../../public' + asset, import.meta.url), 'utf8')
    expect(asset).toMatch(/\.svg$/)
    expect(svg).toContain('viewBox="0 0 64 64"')
    expect(svg).toContain('rx="16"')
    expect(svg).not.toMatch(/<(?:script|image|foreignObject|animate)\b|\son\w+=|(?:href|src)=/i)
    const manifest = JSON.parse(await readFile(new URL('../../../../../assets/demo-assets.json', import.meta.url), 'utf8'))
    const record = manifest.assets.find((entry: { path: string }) => entry.path === 'apps/extension/public' + asset)
    expect(record).toMatchObject({ bytes: Buffer.byteLength(svg), sha256: createHash('sha256').update(svg).digest('hex') })
  })

  it.each(paths)('keeps white glyphs above 3:1 against both gradient stops: %s', async (asset) => {
    const svg = await readFile(new URL('../../../public' + asset, import.meta.url), 'utf8')
    const stops = [...svg.matchAll(/stop-color="(#[a-f0-9]{6})"/g)]
    expect(stops).toHaveLength(2)
    for (const [, hex] of stops) {
      const channels = hex.slice(1).match(/../g)!.map((value) => {
        const channel = parseInt(value, 16) / 255
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
      })
      const luminance = channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722
      expect(1.05 / (luminance + .05)).toBeGreaterThanOrEqual(3)
    }
  })
})
