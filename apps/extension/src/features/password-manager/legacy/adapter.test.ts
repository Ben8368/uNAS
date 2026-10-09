import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('UniPass source boundary', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('keeps production dependencies behind the Legacy adapter', () => {
    const root = path.resolve(import.meta.dirname, '..')
    const files = readdirSync(root, { recursive: true, withFileTypes: true })
      .filter(entry => entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.(?:test|d)\.tsx?$/.test(entry.name))
    for (const entry of files) {
      const file = path.join(entry.parentPath, entry.name)
      if (file === path.join(root, 'legacy/adapter.ts')) continue
      const text = readFileSync(file, 'utf8')
      expect(text, path.relative(root, file)).not.toMatch(/(?:from|import)\s*\(?\s*['"][^'"]*(?:sources\/UniPass|unipass-extension(?:\/[^'"]*)?|shared\/api|\/credential-core|\/jupiter-keepalive|\/unipass-login|\/legacy-catalog)['"]/)
    }
  })

  it('imports without Chrome and installs Legacy listeners once on explicit composition', async () => {
    vi.resetModules()
    vi.stubGlobal('chrome', undefined)
    const { installLegacyAdapter } = await import('./adapter')
    const alarms = vi.fn()
    const updated = vi.fn()
    const removed = vi.fn()
    const get = vi.fn(async () => ({}))
    vi.stubGlobal('chrome', {
      storage: { session: { get }, local: { get } },
      alarms: { onAlarm: { addListener: alarms }, clear: vi.fn(async () => true) },
      tabs: { onUpdated: { addListener: updated }, onRemoved: { addListener: removed } },
    })
    installLegacyAdapter()
    installLegacyAdapter()
    await Promise.resolve()
    expect(alarms).toHaveBeenCalledTimes(1)
    expect(updated).toHaveBeenCalledTimes(1)
    expect(removed).toHaveBeenCalledTimes(1)
  })
})
