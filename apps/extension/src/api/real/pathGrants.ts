import { apiRequest, ApiRequestError } from 'unas-src/api/http'
import type { PathGrantInfo, PathGrantKind, PathGrantResponse } from '#contracts'

export async function requestReadGrant(): Promise<PathGrantInfo | null> {
  throw new Error('CAPABILITY_UNAVAILABLE：扩展未接入真实文件授权 adapter。')
}

export async function requestWriteGrant(defaultPath?: string): Promise<PathGrantInfo | null> {
  throw new Error('CAPABILITY_UNAVAILABLE：扩展未接入真实文件授权 adapter。')
}

export async function requestDirReadGrant(): Promise<PathGrantInfo | null> {
  throw new Error('CAPABILITY_UNAVAILABLE：扩展未接入真实文件授权 adapter。')
}

export async function getPathGrant(id: string): Promise<PathGrantInfo | null> {
  try {
    const result = await apiRequest<PathGrantResponse>(`/api/path-grants/${encodeURIComponent(id)}`)
    return result.grant ?? null
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) return null
    throw err
  }
}

export async function revokePathGrant(id: string): Promise<boolean> {
  const result = await apiRequest<{ ok: boolean }>(`/api/path-grants/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  return result?.ok ?? false
}

export type { PathGrantInfo, PathGrantKind }
