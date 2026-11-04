import type { WorkbenchAppId } from '#contracts'
import { APP_ICON_PATHS } from 'unas-src/shared/icons/appIcons'

export type AppMetadata = Readonly<{
  id: WorkbenchAppId
  title: string
  label: string
  icon: string
  status: 'stable' | 'beta' | 'hidden'
  launcherVisible?: boolean
}>

// Data only: Desktop, launcher and window state must not import App components.
// Keys are stable persisted IDs; insertion order is the desktop/launcher order.
export const APP_CATALOG = {
  'browser': { id: 'browser', label: '添加 App', title: '添加 App', icon: APP_ICON_PATHS.browser, status: 'beta' },
  'file-manager': { id: 'file-manager', label: '文件管理', title: '文件管理', icon: APP_ICON_PATHS['file-manager'], status: 'stable' },
  'fetcher': { id: 'fetcher', label: '下载', title: '下载', icon: APP_ICON_PATHS.fetcher, status: 'stable' },
  'password-manager': { id: 'password-manager', label: '密码管家', title: '密码管家', icon: APP_ICON_PATHS['password-manager'], status: 'stable' },
  'adblock': { id: 'adblock', label: '广告拦截', title: '广告拦截', icon: APP_ICON_PATHS.adblock, status: 'beta' },
  'music': { id: 'music', label: '音乐解锁', title: '音乐解锁', icon: APP_ICON_PATHS.music, status: 'beta' },
  'settings': { id: 'settings', label: '设置', title: '设置', icon: APP_ICON_PATHS.settings, status: 'beta', launcherVisible: false },
  'logs': { id: 'logs', label: '日志', title: '日志', icon: APP_ICON_PATHS.logs, status: 'hidden', launcherVisible: false },
} as const satisfies { [Id in WorkbenchAppId]: AppMetadata & { id: Id } }

export const appCatalog: readonly AppMetadata[] = Object.values(APP_CATALOG)
const appCatalogById = new Map(appCatalog.map((app) => [app.id, app]))

export function getAppMetadata(appId: string): AppMetadata | undefined {
  return appCatalogById.get(appId as WorkbenchAppId)
}

export function getLauncherApps(): readonly AppMetadata[] {
  return appCatalog.filter((app) => app.launcherVisible !== false && app.status !== 'hidden')
}
