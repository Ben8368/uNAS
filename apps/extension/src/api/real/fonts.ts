import { apiRequest } from 'unas-src/api/http'
import type { FontsListResponse } from '#contracts'

export function listSystemFonts(): Promise<FontsListResponse> {
  return apiRequest<FontsListResponse>('/api/fonts/system')
}
