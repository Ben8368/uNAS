import { useEffect } from 'react'
import { WALLPAPERS } from 'unas-src/appearance'
import { useSystemStore } from 'unas-src/store'

export function useAppearance() {
  const { themeMode, wallpaper, reduceMotion, reduceTransparency, highContrast } = useSystemStore()
  useEffect(() => {
    const theme = matchMedia('(prefers-color-scheme: dark)')
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const transparency = matchMedia('(prefers-reduced-transparency: reduce)')
    const contrast = matchMedia('(prefers-contrast: more)')
    const update = () => {
      const root = document.documentElement
      const resolvedTheme = themeMode === 'system' ? (theme.matches ? 'dark' : 'light') : themeMode
      root.dataset.theme = resolvedTheme
      root.className = resolvedTheme
      root.style.colorScheme = resolvedTheme
      root.dataset.reduceMotion = String(reduceMotion || motion.matches)
      root.dataset.reduceTransparency = String(reduceTransparency || transparency.matches)
      root.dataset.highContrast = String(highContrast || contrast.matches)
      const selectedWallpaper = WALLPAPERS[wallpaper] ?? WALLPAPERS[2]
      root.style.removeProperty('--mt-wp')
      root.style.setProperty('--mt-wp-srgb', selectedWallpaper.gradientSrgb)
      root.style.setProperty('--mt-wp-p3', selectedWallpaper.gradientP3)
    }
    const queries = [theme, motion, transparency, contrast]
    update()
    queries.forEach((query) => query.addEventListener('change', update))
    return () => queries.forEach((query) => query.removeEventListener('change', update))
  }, [themeMode, wallpaper, reduceMotion, reduceTransparency, highContrast])
}
