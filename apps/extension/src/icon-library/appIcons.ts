const BASE = '/static/app/icons/default'

export const APP_ICON_PATHS = {
  browser:     `${BASE}/browser.svg`,
  fetcher:     `${BASE}/download.svg`,
  fileManager: `${BASE}/files.svg`,
  'file-manager': `${BASE}/files.svg`,
  transcode:   `${BASE}/media.svg`,
  ps:          `${BASE}/layers.svg`,
  settings:    `${BASE}/settings.svg`,
  logs:        `${BASE}/logs.svg`,
  image:       `${BASE}/image.svg`,
  pdf:         `${BASE}/document.svg`,
  archive:     `${BASE}/archive.svg`,
  tasks:       `${BASE}/tasks.svg`,
} as const

export type AppId = keyof typeof APP_ICON_PATHS

export const FALLBACK_ICON = `${BASE}/settings.svg`

export function getAppIcon(appId: string): string {
  return (APP_ICON_PATHS as Record<string, string>)[appId] ?? FALLBACK_ICON
}
