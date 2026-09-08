import { useSyncExternalStore } from 'react'

const P3_MEDIA_QUERY = '(color-gamut: p3)'

export type ColorGamut = 'srgb' | 'p3'

function getMediaQueryList() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  return window.matchMedia(P3_MEDIA_QUERY)
}

export function getColorGamut(): ColorGamut {
  return getMediaQueryList()?.matches ? 'p3' : 'srgb'
}

export function getColorGamutLabel(gamut: ColorGamut): 'sRGB' | 'P3' {
  return gamut === 'p3' ? 'P3' : 'sRGB'
}

function subscribe(onStoreChange: () => void) {
  const mediaQuery = getMediaQueryList()
  if (!mediaQuery) return () => undefined

  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', onStoreChange)
    return () => mediaQuery.removeEventListener('change', onStoreChange)
  }

  mediaQuery.addListener(onStoreChange)
  return () => mediaQuery.removeListener(onStoreChange)
}

export function useColorGamut() {
  return useSyncExternalStore(subscribe, getColorGamut, () => 'srgb' as const)
}
