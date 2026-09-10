import { describe, expect, it } from 'vitest'

import { ZIP_EXTRACTION_LIMITS, safeArchivePath, validateArchiveEntries } from './zipSafety'

describe('ZIP extraction safety', () => {
  it('keeps a safe relative path and explicit directory entries', () => {
    expect(safeArchivePath('reports/2026/', true)).toBe('reports/2026')
    expect(validateArchiveEntries([{ path: 'reports/2026/summary.txt', directory: false, size: 12 }])[0]?.path).toBe('reports/2026/summary.txt')
  })

  it.each(['../secret.txt', '/absolute.txt', 'C:/drive.txt', 'folder\\escape.txt', 'nul.txt', 'folder//double.txt'])('rejects unsafe ZIP paths: %s', (path) => {
    expect(() => safeArchivePath(path, false)).toThrow('ZIP_UNSAFE_PATH')
  })

  it('rejects encrypted entries, symlinks, collisions, and output bombs', () => {
    expect(() => validateArchiveEntries([{ path: 'locked.txt', directory: false, size: 1, encrypted: true }])).toThrow('ZIP_ENCRYPTED_ENTRY')
    expect(() => validateArchiveEntries([{ path: 'link', directory: false, size: 1, symlink: true }])).toThrow('ZIP_SYMLINK_ENTRY')
    expect(() => validateArchiveEntries([
      { path: 'file', directory: false, size: 1 },
      { path: 'file/child.txt', directory: false, size: 1 },
    ])).toThrow('ZIP_FILE_DIRECTORY_CONFLICT')
    expect(() => validateArchiveEntries([{ path: 'large.bin', directory: false, size: ZIP_EXTRACTION_LIMITS.maxOutputBytes + 1 }])).toThrow('ZIP_ENTRY_TOO_LARGE')
  })
})
