import type { FileEntry } from './filesystem'

export type DavFileEntry = FileEntry & { executionSource: 'real'; etag?: string }
export type DavDirectoryListing = { path: string; entries: DavFileEntry[]; truncated: boolean }
export type DavConnectionInput = { endpoint: string; consent: boolean } & ({ connectionId: string } | { username: string; appPassword: string })
export type CacheEntry = { id: string; name: string; size: number; createdAt: number; expiresAt: number; trashedAt?: number }
export type CacheSnapshot = {
  entries: CacheEntry[]
  usedBytes: number
  maxFileBytes: number
  quota?: number
  originUsage?: number
  protected: boolean
}
