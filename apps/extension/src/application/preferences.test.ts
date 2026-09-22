import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultPreferences, readPreferences, savePreferences } from './preferences'

afterEach(() => vi.unstubAllGlobals())

describe('dark-only tab preferences', () => {
  it.each(['light', 'system', 'dark'])('ignores legacy %s without losing wallpaper or accessibility preferences', (themeMode) => {
    const preferences = { wallpaper: 3, reduceMotion: true, reduceTransparency: true, highContrast: true }
    const setItem = vi.fn()
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ schemaVersion: 1, themeMode, ...preferences }), setItem })
    expect(readPreferences()).toEqual(preferences)
    expect(savePreferences(readPreferences())).toBe(true)
    expect(JSON.parse(setItem.mock.calls[0][1])).toEqual({ schemaVersion: 1, ...preferences })
  })

  it.each(['null', '{', '{}'])('uses defaults for invalid storage: %s', (value) => {
    vi.stubGlobal('localStorage', { getItem: () => value })
    expect(readPreferences()).toEqual(defaultPreferences)
  })

  it('retains storage failure feedback', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('Denied') }, setItem: () => { throw new Error('Denied') } })
    expect(readPreferences()).toEqual(defaultPreferences)
    expect(savePreferences(defaultPreferences)).toBe(false)
  })
})
