import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

describe('WebDAV layering', () => {
  it('does not import password manager, React, storage or extension permission APIs', () => {
    for (const file of ['client.ts', '../../shared/webdav-url.ts']) {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8')
      expect(source).not.toMatch(/modules\/password-manager|from ['"]react|chrome\.|browser\.|localStorage|indexedDB/)
    }
  })
  it('does not advertise unimplemented GitHub or Cloudflare Vault backends', () => {
    const source = readFileSync(new URL('../../modules/password-manager/shared/vault.ts', import.meta.url), 'utf8')
    expect(source).toContain('export type VaultBackendType = "webdav";')
  })
  it('keeps Legacy API and WASM out of Vault implementation imports', () => {
    const directory = new URL('../../modules/password-manager/background/vault/', import.meta.url)
    for (const file of readdirSync(fileURLToPath(directory)).filter(name => name.endsWith('.ts') && !name.includes('.test.'))) {
      expect(readFileSync(new URL(file, directory), 'utf8')).not.toMatch(/from ['"][^'"]*(?:shared\/api|legacy-credential-source|credential-core)['"]/)
    }
  })
})
