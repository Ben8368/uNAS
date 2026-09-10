export const ZIP_EXTRACTION_LIMITS = Object.freeze({
  maxInputBytes: 50 * 1024 * 1024,
  maxEntries: 200,
  maxEntryBytes: 32 * 1024 * 1024,
  maxOutputBytes: 64 * 1024 * 1024,
  maxDepth: 12,
  maxSegmentLength: 120,
})

const windowsReservedName = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i

export type SafeArchiveEntry = {
  path: string
  directory: boolean
  size: number
  encrypted?: boolean
  symlink?: boolean
}

export function safeArchivePath(rawPath: string, directory: boolean): string {
  if (!rawPath || rawPath.length > 2048 || rawPath.includes('\\') || rawPath.startsWith('/') || /^[a-z]:/i.test(rawPath)) {
    throw new Error('ZIP_UNSAFE_PATH')
  }
  const segments = rawPath.split('/')
  if (directory && segments.at(-1) === '') segments.pop()
  if (!segments.length || segments.some((segment) => !safeSegment(segment))) throw new Error('ZIP_UNSAFE_PATH')
  if (segments.length > ZIP_EXTRACTION_LIMITS.maxDepth) throw new Error('ZIP_PATH_TOO_DEEP')
  return segments.join('/')
}

export function validateArchiveEntries(entries: readonly SafeArchiveEntry[]): SafeArchiveEntry[] {
  if (!entries.length) throw new Error('ZIP_EMPTY_ARCHIVE')
  if (entries.length > ZIP_EXTRACTION_LIMITS.maxEntries) throw new Error('ZIP_TOO_MANY_ENTRIES')

  const paths = new Set<string>()
  const filePaths = new Set<string>()
  let outputBytes = 0
  const safeEntries = entries.map((entry) => {
    if (entry.encrypted) throw new Error('ZIP_ENCRYPTED_ENTRY')
    if (entry.symlink) throw new Error('ZIP_SYMLINK_ENTRY')
    if (!Number.isSafeInteger(entry.size) || entry.size < 0) throw new Error('ZIP_INVALID_SIZE')
    if (!entry.directory && entry.size > ZIP_EXTRACTION_LIMITS.maxEntryBytes) throw new Error('ZIP_ENTRY_TOO_LARGE')
    const path = safeArchivePath(entry.path, entry.directory)
    if (paths.has(path)) throw new Error('ZIP_DUPLICATE_ENTRY')
    paths.add(path)
    if (!entry.directory) {
      outputBytes += entry.size
      if (!Number.isSafeInteger(outputBytes) || outputBytes > ZIP_EXTRACTION_LIMITS.maxOutputBytes) throw new Error('ZIP_OUTPUT_TOO_LARGE')
      filePaths.add(path)
    }
    return { ...entry, path }
  })

  for (const filePath of filePaths) {
    const segments = filePath.split('/')
    for (let index = 1; index < segments.length; index += 1) {
      if (filePaths.has(segments.slice(0, index).join('/'))) throw new Error('ZIP_FILE_DIRECTORY_CONFLICT')
    }
  }
  return safeEntries
}

function safeSegment(segment: string) {
  return Boolean(segment) && segment !== '.' && segment !== '..' && segment.length <= ZIP_EXTRACTION_LIMITS.maxSegmentLength &&
    !Array.from(segment).some((character) => character.charCodeAt(0) < 32) && !/[<>:"|?*]/.test(segment) && !/[. ]$/.test(segment) && !windowsReservedName.test(segment)
}
