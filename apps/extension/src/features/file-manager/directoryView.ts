import type { FileEntry } from '#contracts'

export type DirectorySort = 'name' | 'modified' | 'size'

export function directoryEntries(entries: FileEntry[], query: string, sort: DirectorySort) {
  const search = query.trim().toLocaleLowerCase()
  return entries.filter((entry) => entry.name.toLocaleLowerCase().includes(search)).sort((left, right) => {
    if (left.type !== right.type) return left.type === 'directory' ? -1 : 1
    const difference = sort === 'size' ? right.size - left.size
      : sort === 'modified' ? (Date.parse(right.modified) || 0) - (Date.parse(left.modified) || 0) : 0
    return difference || left.name.localeCompare(right.name, 'zh-CN', { numeric: true, sensitivity: 'base' })
  })
}
