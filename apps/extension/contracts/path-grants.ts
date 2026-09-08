import type { OkResult } from './core.js'

export type ResourceGrantKind = 'file.read' | 'file.write' | 'dir.read' | 'dir.write'
export type ResourceGrantStatus = 'active' | 'consumed' | 'revoked' | 'expired'

/**
 * Cross-context grant metadata. The matching FileSystemHandle is adapter-private
 * state and is never represented by a physical path in a shared contract.
 */
export type ResourceGrant = {
  id: string
  kind: ResourceGrantKind
  status: ResourceGrantStatus
  displayName: string
  expiresAt: number
  createdAt: number
  updatedAt: number
  jobId?: string
}

export type ResourceGrantResponse = OkResult & { grant?: ResourceGrant }
export type ResourceGrantListResponse = OkResult & { grants: ResourceGrant[] }

/** @deprecated Use ResourceGrantKind for new contracts. */
export type PathGrantKind = ResourceGrantKind
/** @deprecated Use ResourceGrantStatus for new contracts. */
export type PathGrantStatus = ResourceGrantStatus
/** @deprecated Use ResourceGrant for new contracts. */
export type PathGrantInfo = ResourceGrant
/** @deprecated Use ResourceGrant for new contracts. */
export type PathGrantRecord = ResourceGrant
/** @deprecated Use ResourceGrantResponse for new contracts. */
export type PathGrantResponse = ResourceGrantResponse
/** @deprecated Use ResourceGrantListResponse for new contracts. */
export type PathGrantListResponse = ResourceGrantListResponse
