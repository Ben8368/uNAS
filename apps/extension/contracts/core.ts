export type WorkbenchAppId = 'browser' | 'file-manager' | 'fetcher' | 'transcode' | 'ps' | 'settings' | 'logs' | 'image' | 'pdf' | 'archive' | 'tasks'

export type OkResult = {
  executionSource?: 'mock' | 'real'
  ok: boolean
  message?: string
}

export type WorkbenchApp = {
  id: WorkbenchAppId
  title: string
  kind: 'core' | 'workbench' | 'system'
}

export type AppsResponse = {
  apps: WorkbenchApp[]
}

export type HealthResponse = {
  ok: boolean
  service: string
  version: string
}
