import { create } from 'zustand'
import { readPreferences, savePreferences, type AppearancePreferences } from 'unas-src/application/preferences'

interface SystemStore extends AppearancePreferences {
  showLauncher: boolean
  preferenceNotice: string
  systemLifecycle: 'running' | 'shutting-down' | 'shutdown-complete'
  setShowLauncher: (show: boolean) => void
  toggleLauncher: () => void
  setThemeMode: (mode: AppearancePreferences['themeMode']) => void
  setWallpaper: (idx: number) => void
  setAccessibility: (key: 'reduceMotion' | 'reduceTransparency' | 'highContrast', value: boolean) => void
  beginSystemShutdown: () => void
  completeSystemShutdown: () => void
  resetSystemLifecycle: () => void
}
export const useSystemStore = create<SystemStore>()((set) => {
  const update = (patch: Partial<AppearancePreferences>) => set((state) => {
    const next = { ...state, ...patch }
    const saved = savePreferences(next)
    return { ...patch, preferenceNotice: saved ? '外观偏好已保存到此浏览器。' : '浏览器未允许保存；本次会话中的外观仍已更新。' }
  })
  return {
    ...readPreferences(), showLauncher: false,
    preferenceNotice: '外观偏好仅保存在此浏览器，不上传。', systemLifecycle: 'running',
    setShowLauncher: (show) => set({ showLauncher: show }),
    toggleLauncher: () => set((state) => ({ showLauncher: !state.showLauncher })),
    setThemeMode: (themeMode) => update({ themeMode }), setWallpaper: (wallpaper) => update({ wallpaper }),
    setAccessibility: (key, value) => update({ [key]: value }),
    beginSystemShutdown: () => set({ systemLifecycle: 'shutting-down' }),
    completeSystemShutdown: () => set({ systemLifecycle: 'shutdown-complete' }),
    resetSystemLifecycle: () => set({ systemLifecycle: 'running' }),
  }
})
