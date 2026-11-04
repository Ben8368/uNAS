import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { WorkbenchAppId } from '#contracts'

import { appCatalog, type AppMetadata } from './appCatalog'

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

type AppImplementation = {
  component: ComponentType | LazyExoticComponent<ComponentType>
  headerStatus?: ComponentType | LazyExoticComponent<ComponentType>
}

// Only the window host consumes implementations. React.lazy keeps feature code deferred.
const implementations = {
  browser: { component: BrowserApp },
  'file-manager': { component: FileManagerApp, headerStatus: FileWorkspaceModeControl },
  fetcher: { component: DownloaderApp },
  'password-manager': { component: PasswordManagerApp },
  adblock: { component: AdBlockApp },
  music: { component: MusicApp },
  settings: { component: SettingsApp, headerStatus: ColorGamutStatus },
  logs: { component: LogViewer },
} satisfies Record<WorkbenchAppId, AppImplementation>

export type RegisteredApp = AppMetadata & AppImplementation
export const appRegistry: readonly RegisteredApp[] = appCatalog.map((app) => ({ ...app, ...implementations[app.id] }))
const appRegistryById = new Map(appRegistry.map((app) => [app.id, app]))

export function getRegisteredApp(appId: string): RegisteredApp | undefined {
  return appRegistryById.get(appId as WorkbenchAppId)
}
