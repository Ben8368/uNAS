import { describe, expect, it } from 'vitest'
import type { FileEntry } from '#contracts'
import { directoryEntries } from './directoryView'

const entries: FileEntry[] = [
  { name: 'Notes10.md', path: '/10', type: 'file', size: 10, modified: '2026-09-01' },
  { name: 'Notes2.md', path: '/2', type: 'file', size: 20, modified: '2026-09-08' },
  { name: 'Projects', path: '/projects', type: 'directory', size: 0, modified: '' },
]

describe('directory view', () => {
  it('keeps folders first and sorts names naturally without mutating the source', () => {
    expect(directoryEntries(entries, '', 'name').map((entry) => entry.path)).toEqual(['/projects', '/2', '/10'])
    expect(entries[0].path).toBe('/10')
  })
  it('filters names case-insensitively and trims the query', () => {
    expect(directoryEntries(entries, ' NOTES2 ', 'name').map((entry) => entry.path)).toEqual(['/2'])
    expect(directoryEntries(entries, 'missing', 'name')).toEqual([])
  })
  it('sorts newest and largest first while retaining folder priority', () => {
    for (const sort of ['modified', 'size'] as const) {
      expect(directoryEntries(entries, '', sort).map((entry) => entry.path)).toEqual(['/projects', '/2', '/10'])
    }
  })
})
