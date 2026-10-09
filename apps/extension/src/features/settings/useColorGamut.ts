import { useSyncExternalStore } from 'react'

const P3_MEDIA_QUERY = '(color-gamut: p3)'
const REC2020_MEDIA_QUERY = '(color-gamut: rec2020)'

export type ColorGamut = 'srgb' | 'p3' | 'rec2020'

function getMediaQueries() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return []
  return [window.matchMedia(P3_MEDIA_QUERY), window.matchMedia(REC2020_MEDIA_QUERY)]
}

export function getColorGamut(): ColorGamut {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'srgb'
  if (window.matchMedia(REC2020_MEDIA_QUERY).matches) return 'rec2020'
  return window.matchMedia(P3_MEDIA_QUERY).matches ? 'p3' : 'srgb'
}

export function getColorGamutLabel(gamut: ColorGamut): 'sRGB' | 'P3' | 'Rec. 2020' {
  if (gamut === 'rec2020') return 'Rec. 2020'
  return gamut === 'p3' ? 'P3' : 'sRGB'
}

function subscribe(onStoreChange: () => void) {
  const mediaQueries = getMediaQueries()
  if (!mediaQueries.length) return () => undefined

  if (typeof mediaQueries[0].addEventListener === 'function') {
    mediaQueries.forEach((mediaQuery) => mediaQuery.addEventListener('change', onStoreChange))
    return () => mediaQueries.forEach((mediaQuery) => mediaQuery.removeEventListener('change', onStoreChange))
  }

  mediaQueries.forEach((mediaQuery) => mediaQuery.addListener(onStoreChange))
  return () => mediaQueries.forEach((mediaQuery) => mediaQuery.removeListener(onStoreChange))
}

export function useColorGamut() {
  return useSyncExternalStore(subscribe, getColorGamut, () => 'srgb' as const)
}
