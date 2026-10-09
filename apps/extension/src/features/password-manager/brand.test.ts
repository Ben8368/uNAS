import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = path.resolve(import.meta.dirname, '../../../../..')
const read = (file: string) => readFileSync(path.join(root, file), 'utf8')

describe('uNAS brand and repository independence', () => {
  it('keeps the compatibility package internal and removes distribution plumbing', () => {
    const manifest = JSON.parse(read('packages/password-compat/package.json'))
    expect(manifest.name).toBe('@unas/password-compat')
    expect(manifest.private).toBe(true)
    expect(manifest.exports).toEqual({ './legacy': './src/legacy/index.ts' })
    for (const file of ['scripts/unipass-export.mjs', 'scripts/unipass-sync', 'packages/unipass',
      'packages/password-compat/.github/workflows/release.yml']) {
      expect(existsSync(path.join(root, file)), file).toBe(false)
    }
    for (const file of ['package.json', '.github/workflows/ci.yml', '.github/dependabot.yml',
      'packages/password-compat/scripts/traffic-light-check.mjs']) {
      expect(read(file), file).not.toMatch(/Ben8368\/UniPass|unipass:export|clients2\.google\.com|gjphikebcceegfolnbfncepfmjnhdkam/i)
    }
  })

  it('exposes only uNAS in HTML surfaces and the internal test manifest', () => {
    for (const base of ['apps/extension', 'packages/password-compat/src']) {
      const directory = path.join(root, base)
      const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
        .filter(entry => !['node_modules', '.output', '.wxt', 'dist', 'playwright-report', 'test-results'].includes(entry.name))
        .flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : entry.name.endsWith('.html') ? [path.join(dir, entry.name)] : [])
      for (const file of walk(directory)) expect(readFileSync(file, 'utf8'), file).not.toMatch(/unipass/i)
    }
    const manifest = JSON.parse(read('packages/password-compat/public/manifest.json'))
    expect(manifest.name).toBe('uNAS')
    expect(manifest.action.default_title).toBe('uNAS')
    expect(manifest.key).toBeUndefined()
    expect(manifest.update_url).toBeUndefined()
  })
})
