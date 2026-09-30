import type { FileEntry } from './filesystem'

export type DavFileEntry = FileEntry & { executionSource: 'real'; etag?: string }
export type DavDirectoryListing = { path: string; entries: DavFileEntry[]; truncated: boolean }
export type DavConnectionInput = { endpoint: string; username: string; appPassword: string; consent: boolean }
export type CacheEntry = { id: string; name: string; size: number; createdAt: number; expiresAt: number; trashedAt?: number }
export type CacheSnapshot = {
  entries: CacheEntry[]
  usedBytes: number
  maxBytes: number
  maxFileBytes: number
  quota?: number
  originUsage?: number
  protected: boolean
}
