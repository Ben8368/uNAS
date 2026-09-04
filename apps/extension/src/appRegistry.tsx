import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { WorkbenchAppId } from '#contracts'

import { APP_ICON_PATHS } from 'unas-src/icon-library'

const BrowserApp = lazy(() => import('unas-src/apps/BrowserApp').then((module) => ({ default: module.BrowserApp })))
const DownloaderApp = lazy(() => import('unas-src/apps/DownloaderApp').then((module) => ({ default: module.DownloaderApp })))
const FileManagerApp = lazy(() => import('unas-src/apps/FileManagerApp').then((module) => ({ default: module.FileManagerApp })))
const PsdApp = lazy(() => import('unas-src/apps/PsdApp').then((module) => ({ default: module.PsdApp })))
const SettingsApp = lazy(() => import('unas-src/apps/SettingsApp').then((module) => ({ default: module.SettingsApp })))
const TranscodeApp = lazy(() => import('unas-src/apps/TranscodeApp').then((module) => ({ default: module.TranscodeApp })))
const LogViewer = lazy(() => import('unas-src/LogViewer').then((module) => ({ default: module.LogViewer })))
const ImageApp = lazy(() => import('unas-src/apps/DemoToolApp').then((module) => ({ default: module.ImageApp })))
const PdfApp = lazy(() => import('unas-src/apps/DemoToolApp').then((module) => ({ default: module.PdfApp })))
const ArchiveApp = lazy(() => import('unas-src/apps/DemoToolApp').then((module) => ({ default: module.ArchiveApp })))
const TaskCenterApp = lazy(() => import('unas-src/apps/DemoToolApp').then((module) => ({ default: module.TaskCenterApp })))

export type RegisteredApp = {
  id: WorkbenchAppId
  title: string
  label: string
  icon: string
  component: ComponentType | LazyExoticComponent<ComponentType>
  status: 'stable' | 'beta' | 'hidden'
  launcherVisible?: boolean
}

export const appRegistry: RegisteredApp[] = [
  { id: 'browser', label: '网址 App', title: '网址 App', icon: APP_ICON_PATHS.browser, component: BrowserApp, status: 'beta' },
  { id: 'image', label: 'Image', title: 'Image · 模拟转换', icon: APP_ICON_PATHS.image, component: ImageApp, status: 'beta' },
  { id: 'pdf', label: 'PDF', title: 'PDF · 模拟提取', icon: APP_ICON_PATHS.pdf, component: PdfApp, status: 'beta' },
  { id: 'archive', label: 'Archive', title: 'Archive · 模拟打包', icon: APP_ICON_PATHS.archive, component: ArchiveApp, status: 'beta' },
  { id: 'tasks', label: '任务中心', title: 'Task Center', icon: APP_ICON_PATHS.tasks, component: TaskCenterApp, status: 'beta' },
  { id: 'file-manager', label: '文件管理', title: '文件管理', icon: APP_ICON_PATHS.fileManager, component: FileManagerApp, status: 'stable' },
  { id: 'fetcher', label: '下载', title: '下载', icon: APP_ICON_PATHS.fetcher, component: DownloaderApp, status: 'stable' },
  { id: 'transcode', label: 'Media', title: 'Media · 模拟转码', icon: APP_ICON_PATHS.transcode, component: TranscodeApp, status: 'beta' },
  { id: 'ps', label: 'PS', title: 'PS', icon: APP_ICON_PATHS.ps, component: PsdApp, status: 'beta' },
  { id: 'settings', label: '设置', title: '设置', icon: APP_ICON_PATHS.settings, component: SettingsApp, status: 'beta', launcherVisible: false },
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
