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
