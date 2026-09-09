import { afterEach, describe, expect, it, vi } from 'vitest'

import { getColorGamut, getColorGamutLabel } from 'unas-src/hooks/useColorGamut'

afterEach(() => vi.unstubAllGlobals())

describe('color gamut status', () => {
  it('uses the user-facing labels for the supported display gamut states', () => {
    expect(getColorGamutLabel('srgb')).toBe('sRGB')
    expect(getColorGamutLabel('p3')).toBe('P3')
    expect(getColorGamutLabel('rec2020')).toBe('Rec. 2020')
  })

  it('reports the narrowest supported output gamut when media queries are available', () => {
    const queries = new Map([
      ['(color-gamut: p3)', false],
      ['(color-gamut: rec2020)', false],
    ])
    vi.stubGlobal('window', { matchMedia: (query: string) => ({ matches: queries.get(query) ?? false }) })
    expect(getColorGamut()).toBe('srgb')

    queries.set('(color-gamut: p3)', true)
    expect(getColorGamut()).toBe('p3')

    queries.set('(color-gamut: rec2020)', true)
    expect(getColorGamut()).toBe('rec2020')
  })
})
