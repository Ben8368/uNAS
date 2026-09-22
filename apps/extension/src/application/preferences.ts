import { WALLPAPERS } from 'unas-src/appearance'

export interface AppearancePreferences {
  wallpaper: number
  reduceMotion: boolean
  reduceTransparency: boolean
  highContrast: boolean
}
const KEY = 'unas.appearance.v1'
export const defaultPreferences: AppearancePreferences = {
  wallpaper: 2, reduceMotion: false, reduceTransparency: false, highContrast: false,
}
export function readPreferences(): AppearancePreferences {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    if (!value || value.schemaVersion !== 1) return { ...defaultPreferences }
    return {
      wallpaper: Number.isInteger(value.wallpaper) && value.wallpaper >= 0 && value.wallpaper < WALLPAPERS.length ? value.wallpaper : 2,
      reduceMotion: value.reduceMotion === true, reduceTransparency: value.reduceTransparency === true, highContrast: value.highContrast === true,
    }
  } catch { return { ...defaultPreferences } }
}
export function savePreferences(value: AppearancePreferences): boolean {
  try {
    const { wallpaper, reduceMotion, reduceTransparency, highContrast } = value
    localStorage.setItem(KEY, JSON.stringify({ schemaVersion: 1, wallpaper, reduceMotion, reduceTransparency, highContrast }))
    return true
  } catch { return false }
}
