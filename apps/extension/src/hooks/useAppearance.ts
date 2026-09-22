import { useEffect } from 'react'
import { WALLPAPERS } from 'unas-src/appearance'
import { useSystemStore } from 'unas-src/store'

export function useAppearance() {
  const { wallpaper, reduceMotion, reduceTransparency, highContrast } = useSystemStore()
  useEffect(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const transparency = matchMedia('(prefers-reduced-transparency: reduce)')
    const contrast = matchMedia('(prefers-contrast: more)')
    const update = () => {
      const root = document.documentElement
      root.dataset.theme = 'dark'
      root.className = 'dark'
      root.style.colorScheme = 'dark'
      root.dataset.reduceMotion = String(reduceMotion || motion.matches)
      root.dataset.reduceTransparency = String(reduceTransparency || transparency.matches)
      root.dataset.highContrast = String(highContrast || contrast.matches)
      const selectedWallpaper = WALLPAPERS[wallpaper] ?? WALLPAPERS[2]
      root.style.removeProperty('--mt-wp')
      root.style.setProperty('--mt-wp-srgb', selectedWallpaper.gradientSrgb)
      root.style.setProperty('--mt-wp-p3', selectedWallpaper.gradientP3)
    }
    const queries = [motion, transparency, contrast]
    update()
    queries.forEach((query) => query.addEventListener('change', update))
    return () => queries.forEach((query) => query.removeEventListener('change', update))
  }, [wallpaper, reduceMotion, reduceTransparency, highContrast])
}
