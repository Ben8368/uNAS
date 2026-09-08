import { describe, expect, it } from 'vitest'

import type { ResourceGrant } from './path-grants.js'

describe('ResourceGrant', () => {
  it('keeps adapter-private file locations out of the shared payload', () => {
    const grant: ResourceGrant = {
      id: 'grant-001',
      kind: 'file.read',
      status: 'active',
      displayName: 'sample.png',
      createdAt: 1,
      updatedAt: 1,
      expiresAt: 2,
    }

    expect(grant).toEqual({
      id: 'grant-001',
      kind: 'file.read',
      status: 'active',
      displayName: 'sample.png',
      createdAt: 1,
      updatedAt: 1,
      expiresAt: 2,
    })
    expect(grant).not.toHaveProperty('physicalPath')
  })
})
