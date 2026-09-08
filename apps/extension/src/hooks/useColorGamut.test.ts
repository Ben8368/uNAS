import { describe, expect, it } from 'vitest'

import { getColorGamutLabel } from 'unas-src/hooks/useColorGamut'

describe('color gamut status', () => {
  it('uses the user-facing labels for the supported display gamut states', () => {
    expect(getColorGamutLabel('srgb')).toBe('sRGB')
    expect(getColorGamutLabel('p3')).toBe('P3')
  })
})
