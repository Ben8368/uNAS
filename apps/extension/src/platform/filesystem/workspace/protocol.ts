import type { AuthorizedDirectoryListing, FileEntry, FileWorkspaceAccessSnapshot } from '#contracts'

export const CHANNEL_NAME = 'unas-file-workspace-projection-v1'
export const MAX_MESSAGE_BYTES = 200_000
export const REQUEST_TIMEOUT_MS = 5_000
export const MAX_PENDING_REQUESTS = 16

export type ProjectionMessage =
  | { version: 1; type: 'snapshot-request'; sender: string; id: string }
  | { version: 1; type: 'list-request'; sender: string; id: string; path?: string }
  | { version: 1; type: 'snapshot'; sender: string; target?: string; snapshot: FileWorkspaceAccessSnapshot }
  | { version: 1; type: 'list-result'; sender: string; target: string; id: string; listing?: AuthorizedDirectoryListing; error?: string }

export type RequestMessage =
  | { type: 'snapshot-request'; id: string }
  | { type: 'list-request'; id: string; path?: string }

const string = (value: unknown) => typeof value === 'string' && value.length <= 4096
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export function validSnapshot(value: unknown): value is FileWorkspaceAccessSnapshot {
  if (!object(value) || !['idle', 'selecting', 'ready', 'requires-user', 'unavailable', 'error'].includes(String(value.status))) return false
  if (value.grantId !== undefined && !string(value.grantId)) return false
  if (value.displayName !== undefined && !string(value.displayName)) return false
  if (value.message !== undefined && !string(value.message)) return false
  return value.writeAccess === undefined || ['granted', 'requires-user', 'unavailable'].includes(String(value.writeAccess))
}

export function validEntry(value: unknown): value is FileEntry {
  return object(value) && value.executionSource === 'real' && string(value.name) && string(value.path) && typeof value.size === 'number' &&
    typeof value.modified === 'string' && ['file', 'directory'].includes(String(value.type)) && (value.extension === undefined || string(value.extension))
}

export function validListing(value: unknown): value is AuthorizedDirectoryListing {
  return object(value) && value.ok === true && value.executionSource === 'real' && string(value.path) && string(value.displayPath) &&
    typeof value.truncated === 'boolean' && Array.isArray(value.directories) && value.directories.length <= 200 && value.directories.every(validEntry) &&
    Array.isArray(value.files) && value.files.length <= 200 && value.files.every(validEntry)
}

export function validMessage(value: unknown): value is ProjectionMessage {
  if (!object(value) || value.version !== 1 || !string(value.sender) || !value.sender) return false
  try { if (JSON.stringify(value).length > MAX_MESSAGE_BYTES) return false } catch { return false }
  if (value.type === 'snapshot-request') return string(value.id) && Object.keys(value).length === 4
  if (value.type === 'list-request') return string(value.id) && (value.path === undefined || string(value.path)) && Object.keys(value).every((key) => ['version', 'type', 'sender', 'id', 'path'].includes(key))
  if (value.type === 'snapshot') return validSnapshot(value.snapshot) && (value.target === undefined || string(value.target)) && Object.keys(value).every((key) => ['version', 'type', 'sender', 'target', 'snapshot'].includes(key))
  return string(value.target) && string(value.id) && (value.listing === undefined || validListing(value.listing)) && (value.error === undefined || string(value.error)) && Object.keys(value).every((key) => ['version', 'type', 'sender', 'target', 'id', 'listing', 'error'].includes(key))
}
