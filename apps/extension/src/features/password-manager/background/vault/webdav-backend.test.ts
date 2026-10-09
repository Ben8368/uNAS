import { afterEach, describe, expect, it, vi } from 'vitest'
import { WebDavBackend } from './webdav-backend'
import { VaultConflictError } from '../../shared/vault'

afterEach(() => vi.unstubAllGlobals())
const backend = () => new WebDavBackend('https://dav.example/base/', 'test', 'test-only')

describe('Vault adapter on shared WebDAV transport', () => {
  it('preserves object layout and conditional create/update/delete semantics', async () => {
    const requests: Array<{ url: string; method?: string; headers: Headers }> = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      requests.push({ url, method: init.method, headers: new Headers(init.headers) })
      return new Response(null, { status: 201, headers: { ETag: '"new"' } })
    }))
    await backend().put('manifest', new Uint8Array([1]))
    await backend().put('manifest', new Uint8Array([2]), '"old"')
    await backend().delete('manifest', '"new"')
    expect(requests.map(r => r.url)).toEqual(Array(3).fill('https://dav.example/base/objects/manifest.json'))
    expect(requests.map(r => r.method)).toEqual(['PUT', 'PUT', 'DELETE'])
    expect(requests[0].headers.get('If-None-Match')).toBe('*')
    expect(requests[1].headers.get('If-Match')).toBe('"old"')
    expect(requests[2].headers.get('If-Match')).toBe('"new"')
  })

  it.each([409, 412])('preserves conflict semantics for HTTP %s', async status => {
    const fetcher = vi.fn(async () => new Response(null, { status })); vi.stubGlobal('fetch', fetcher)
    await expect(backend().put('manifest', new Uint8Array(), '"old"')).rejects.toBeInstanceOf(VaultConflictError)
    await expect(backend().delete('manifest', '"old"')).rejects.toBeInstanceOf(VaultConflictError)
    expect(fetcher).toHaveBeenCalledTimes(2) // No implicit write retries.
  })

  it('rejects missing ETags and unconditional physical deletion', async () => {
    const fetcher = vi.fn(async () => new Response('{}')); vi.stubGlobal('fetch', fetcher)
    await expect(backend().get('manifest')).rejects.toThrow('ETag')
    await expect(backend().put('manifest', new Uint8Array())).rejects.toThrow('ETag')
    await expect(backend().delete('manifest', '')).rejects.toThrow('expectedRevision')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
