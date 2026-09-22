import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const styles = path.resolve('src/styles')
function cssFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const name = path.join(directory, entry.name)
    return entry.isDirectory() ? cssFiles(name) : name.endsWith('.css') ? [name] : []
  })
}
describe('theme ownership', () => {
  it('defines compatibility theme aliases only in the shared token source', () => {
    for (const file of cssFiles(styles)) {
      if (file.endsWith('window-theme.css')) continue
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/--mt-(?:surface|fill(?:-2)?|border|divider|text-[012]|brand|danger)\s*:/)
    }
  })
  it('keeps global accessibility CSS free from light-theme rescue selectors', () => {
    expect(readFileSync(path.join(styles, 'accessibility.css'), 'utf8')).not.toMatch(/data-theme\s*=\s*['"]light/)
  })
})
describe('shared control material', () => {
  it('centralizes translucent App controls and their opaque accessibility fallback in the token source', () => {
    const source = readFileSync(path.join(styles, 'window-theme.css'), 'utf8')

    expect(source).toContain('--window-surface-raised: rgb(35 57 75 / .66)')
    expect(source).toContain('--window-surface-control: rgb(48 72 91 / .62)')
    expect(source).toContain('--window-scrollbar-track: rgb(7 20 33 / .24)')
    expect(source).toContain("html[data-reduce-transparency='true']")
    expect(source).toContain('--window-surface-control: var(--window-surface-control-solid)')
    expect(source).toContain("html[data-high-contrast='true']")
    expect(source).toContain('--window-scrollbar-thumb: #ffffff')
  })
})

describe('tab / overlay theme boundary', () => {
  it('scopes light tokens to the overlay and keeps its explicit opt-in', () => {
    const source = readFileSync(path.join(styles, 'window-theme.css'), 'utf8')
    expect(source).toContain(":root[data-theme-scope='overlay'][data-theme='light']")
    expect(source).not.toContain("html[data-theme='light']")
  const overlay = readFileSync(path.resolve('src/modules/password-manager/content/page-overlay.ts'), 'utf8')
    expect(overlay).toContain('overlayRoot.dataset.themeScope = "overlay"')
  })
})
