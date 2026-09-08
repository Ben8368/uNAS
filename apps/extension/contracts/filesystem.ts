import type { OkResult } from './core.js'

export type WorkspaceInfo = {
  project_root?: string
  downloads?: string
  exports?: string
}

export type WorkspaceResponse = OkResult & {
  project_root?: string
  workspace?: WorkspaceInfo
}

export type DiskInfo = {
  name: string
  path: string
  total: number
  used: number
  free: number
  root?: string
  browsable?: boolean
}

export type DiskListResponse = OkResult & {
  disks?: DiskInfo[]
}

export type FileEntry = {
  executionSource?: 'mock' | 'real'
  name: string
  path: string
  size: number
  modified: string
  type: 'directory' | 'file'
  extension?: string
  original_path?: string
}

export type DirectoryListResponse = OkResult & {
  path: string
  files: FileEntry[]
  directories: FileEntry[]
}

/** Opaque virtual paths only; never a host filesystem path. */
export type AuthorizedDirectoryListing = DirectoryListResponse & {
  executionSource: 'real'
  displayPath: string
  truncated: boolean
}

export type FileWorkspaceAccessStatus = 'idle' | 'selecting' | 'ready' | 'requires-user' | 'unavailable' | 'error'
/** Write permission is always requested separately from the initial read grant. */
export type FileWorkspaceWriteAccess = 'granted' | 'requires-user' | 'unavailable'

export type FileWorkspaceAccessSnapshot = {
  status: FileWorkspaceAccessStatus
  grantId?: string
  displayName?: string
  message?: string
  writeAccess?: FileWorkspaceWriteAccess
}

export type CreateDirectoryResponse = OkResult & {
  path?: string
}

export type TrashEntry = {
  executionSource?: 'mock' | 'real'
  id: string
  name: string
  original_path: string
  deleted_at: number
  type: 'directory' | 'file'
  size: number
  stored_path: string
}

export type TrashListResponse = OkResult & {
  items?: TrashEntry[]
}

export type SetWorkspaceResponse = OkResult & {
  workspace?: string
}
