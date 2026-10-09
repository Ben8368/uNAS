import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { WorkbenchAppId } from '#contracts'

import { APP_ICON_PATHS } from 'unas-src/shared/icons'

// Declarative only: lazy chunks, no runtime side effects. Workspace connection is owned by WorkspaceAppContent.
const AdBlockApp = lazy(() => import('unas-src/features/adblock/ui').then((module) => ({ default: module.AdBlockApp })))
const PasswordManagerApp = lazy(() => import('unas-src/features/password-manager/ui').then((module) => ({ default: module.PasswordManagerApp })))
const BrowserApp = lazy(() => import('unas-src/features/browser/BrowserApp').then((module) => ({ default: module.BrowserApp })))
const DownloaderApp = lazy(() => import('unas-src/features/downloader/DownloaderApp').then((module) => ({ default: module.DownloaderApp })))
const FileManagerApp = lazy(() => import('unas-src/features/file-manager/FileManagerApp').then((module) => ({ default: module.FileManagerApp })))
const MusicApp = lazy(() => import('unas-src/features/music/ui').then((module) => ({ default: module.MusicApp })))
const SettingsApp = lazy(() => import('unas-src/features/settings/SettingsApp').then((module) => ({ default: module.SettingsApp })))
const LogViewer = lazy(() => import('unas-src/features/logs/LogViewer').then((module) => ({ default: module.LogViewer })))
const FileWorkspaceModeControl = lazy(() => import('unas-src/features/file-manager/FileWorkspaceModeControl').then(module => ({ default: module.FileWorkspaceModeControl })))
const ColorGamutStatus = lazy(() => import('unas-src/features/settings/ColorGamutStatus').then(module => ({ default: module.ColorGamutStatus })))

export type RegisteredApp = {
  id: WorkbenchAppId
  title: string
  label: string
  icon: string
  component: ComponentType | LazyExoticComponent<ComponentType>
  headerStatus?: ComponentType | LazyExoticComponent<ComponentType>
  status: 'stable' | 'beta' | 'hidden'
  launcherVisible?: boolean
}

export const appRegistry: RegisteredApp[] = [
  { id: 'browser', label: '添加 App', title: '添加 App', icon: APP_ICON_PATHS.browser, component: BrowserApp, status: 'beta' },
  { id: 'file-manager', label: '文件管理', title: '文件管理', icon: APP_ICON_PATHS.fileManager, component: FileManagerApp, headerStatus: FileWorkspaceModeControl, status: 'stable' },
  { id: 'fetcher', label: '下载', title: '下载', icon: APP_ICON_PATHS.fetcher, component: DownloaderApp, status: 'stable' },
  { id: 'password-manager', label: '密码管家', title: '密码管家', icon: APP_ICON_PATHS['password-manager'], component: PasswordManagerApp, status: 'stable' },
  { id: 'adblock', label: '广告拦截', title: '广告拦截', icon: APP_ICON_PATHS.adblock, component: AdBlockApp, status: 'beta' },
  { id: 'music', label: '音乐解锁', title: '音乐解锁', icon: APP_ICON_PATHS.music, component: MusicApp, status: 'beta' },
  { id: 'settings', label: '设置', title: '设置', icon: APP_ICON_PATHS.settings, component: SettingsApp, headerStatus: ColorGamutStatus, status: 'beta', launcherVisible: false },
  { id: 'logs', label: '日志', title: '日志', icon: APP_ICON_PATHS.logs, component: LogViewer, status: 'hidden', launcherVisible: false },
]

const appRegistryById = new Map(appRegistry.map((app) => [app.id, app]))

export function getRegisteredApp(appId: string): RegisteredApp | undefined {
  return appRegistryById.get(appId as WorkbenchAppId)
}

export function getAppMetadata(appId: string): Pick<RegisteredApp, 'id' | 'title' | 'label' | 'icon'> | undefined {
  const app = getRegisteredApp(appId)
  if (!app) return undefined
  return {
    id: app.id,
    title: app.title,
    label: app.label,
    icon: app.icon,
  }
}

export function getLauncherApps(): RegisteredApp[] {
  return appRegistry.filter((app) => app.launcherVisible !== false && (app.status === 'stable' || app.status === 'beta'))
}
