const BASE = '/static/app/icons/default'

export const APP_ICON_PATHS = {
  link:        `${BASE}/link.svg`,
  adblock:     `${BASE}/adblock.svg`,
  'password-manager': `${BASE}/password.svg`,
  browser:     `${BASE}/browser.svg`,
  fetcher:     `${BASE}/download.svg`,
  fileManager: `${BASE}/files.svg`,
  'file-manager': `${BASE}/files.svg`,
  transcode:   `${BASE}/media.svg`,
  music:       `${BASE}/music.svg`,
  ps:          `${BASE}/layers.svg`,
  settings:    `${BASE}/settings.svg`,
  logs:        `${BASE}/logs.svg`,
  image:       `${BASE}/image.svg`,
  pdf:         `${BASE}/document.svg`,
  archive:     `${BASE}/archive.svg`,
  tasks:       `${BASE}/tasks.svg`,
} as const

export type AppId = keyof typeof APP_ICON_PATHS

export const FALLBACK_ICON = `${BASE}/app.svg`

export function getAppIcon(appId: string): string {
  return Object.hasOwn(APP_ICON_PATHS, appId) ? APP_ICON_PATHS[appId as AppId] : FALLBACK_ICON
}
