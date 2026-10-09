import type { FileEntry, TrashEntry } from '#contracts'
import type { MockFileMetadata } from './contracts'

type Directory = { directories: FileEntry[]; files: FileEntry[] }
type Deleted = { entry: FileEntry; subtree: Record<string, Directory> }
export const mockFileFixtures = {
  'sample-image': { name: 'sample-image.png', size: 1_240_000 },
  'sample-document': { name: 'sample-document.pdf', size: 128_000 },
  'sample-video': { name: 'sample-video.mp4', size: 8_400_000 },
} as const

/** In-memory fixture tree only. No File, Blob, handles, download URLs or local disk access. */
export function createMockFilesystem(now: () => number, id: (prefix: string) => string, check: (hint?: string) => void) {
  const iso = () => new Date(now() * 1000).toISOString()
  const entry = (path: string, size = 0, type: FileEntry['type'] = 'file'): FileEntry => ({
    executionSource: 'mock', name: path.split('/').pop()!, path, size, modified: iso(), type,
    ...(type === 'file' ? { extension: path.split('.').pop() } : {}),
  })
  let tree: Record<string, Directory> = {}
  let trash: TrashEntry[] = []
  let deleted: Record<string, Deleted> = {}
  function reset(empty = false) {
    tree = { '/Workspace': { directories: ['Downloads', 'Exports', 'Images', 'PSD'].map(name => entry(`/Workspace/${name}`, 0, 'directory')), files: [entry('/Workspace/README-demo.txt', 1200)] } }
    const fixtures: Record<string, [string, number][]> = {
      Downloads: [['brand-track.mp3', 7_600_000], ['product-launch.mp4', 152_000_000]],
      Exports: [['brand-film-h265.mp4', 84_200_000], ['transcode-cover.png', 1_240_000]],
      Images: [['lumora-cover.png', 1_240_000], ['logo-white.svg', 3200]], PSD: [['brand-key-visual.psd', 24_300_000]],
    }
    for (const [folder, files] of Object.entries(fixtures)) tree[`/Workspace/${folder}`] = { directories: [], files: files.map(([name, size]) => entry(`/Workspace/${folder}/${name}`, size)) }
    if (empty) for (const value of Object.values(tree)) value.files = []
    trash = []; deleted = {}
  }
  function validate(path: string) {
    if (!/^\/Workspace(?:\/[^/\\]+)*$/.test(path) || path.split('/').some(p => p === '.' || p === '..')) throw new Error('仅允许演示工作区中的规范路径。')
  }
  function parent(path: string) { return path.slice(0, path.lastIndexOf('/')) }
  function directory(path: string) { validate(path); if (!tree[path]) throw new Error('演示目录不存在。'); return tree[path] }
  function exists(path: string) { return Boolean(tree[path]) || Object.values(tree).some(d => d.files.some(f => f.path === path)) }
  function assertDestination(path: string) { validate(path); directory(parent(path)); if (exists(path)) throw new Error('名称冲突：演示目录已存在同名项目。') }
  reset()
  return {
    reset,
    hasPath: exists,
    async listFilebrowserDirectory({ directory: path }: { directory: string }, signal?: AbortSignal) {
      signal?.throwIfAborted(); check(); const d = directory(path)
      return structuredClone({ ok: true, executionSource: 'mock' as const, path, ...d })
    },
    async createFilebrowserDirectory(path: string) {
      check(); assertDestination(path); directory(parent(path)).directories.push(entry(path, 0, 'directory')); tree[path] = { directories: [], files: [] }
      return { ok: true, path }
    },
    async deleteFilebrowserPath(path: string, toTrash = true) {
      check(path); validate(path); if (path === '/Workspace') throw new Error('不能删除演示工作区根目录。')
      const d = directory(parent(path)); const target = [...d.files, ...d.directories].find(f => f.path === path)
      if (!target) throw new Error('演示项目不存在。')
      const subtree: Record<string, Directory> = {}
      for (const key of Object.keys(tree)) if (key === path || key.startsWith(`${path}/`)) { subtree[key] = tree[key]; delete tree[key] }
      d.files = d.files.filter(f => f.path !== path); d.directories = d.directories.filter(f => f.path !== path)
      if (toTrash) {
        const trashId = id('trash'); deleted[trashId] = { entry: target, subtree }
        trash.unshift({ id: trashId, executionSource: 'mock', name: target.name, original_path: path, deleted_at: now(), type: target.type, size: target.size, stored_path: `mock:trash/${trashId}` })
      }
      return { ok: true }
    },
    async fetchFilebrowserTrash() { return { ok: true, items: structuredClone(trash) } },
    async restoreFilebrowserTrash(trashId: string) {
      check(); const item = deleted[trashId]; if (!item) throw new Error('回收站项目不存在。')
      check(item.entry.path)
      assertDestination(item.entry.path)
      const d = directory(parent(item.entry.path)); (item.entry.type === 'file' ? d.files : d.directories).push(item.entry)
      Object.assign(tree, item.subtree); delete deleted[trashId]; trash = trash.filter(t => t.id !== trashId)
      return { ok: true }
    },
    async purgeFilebrowserTrash(trashId: string) {
      check(); if (!deleted[trashId]) throw new Error('回收站项目不存在。')
      check(deleted[trashId].entry.path)
      delete deleted[trashId]; trash = trash.filter(t => t.id !== trashId); return { ok: true }
    },
    async emptyFilebrowserTrash() { check(); deleted = {}; trash = []; return { ok: true } },
    async uploadFilebrowserFile(path: string, metadata: MockFileMetadata) {
      // Only exact declarative fixture references can enter this adapter, including at runtime.
      if (!metadata || Object.getPrototypeOf(metadata) !== Object.prototype || metadata.executionSource !== 'mock' || Object.keys(metadata).some(key => !['fixtureId', 'executionSource'].includes(key)) || !Object.prototype.hasOwnProperty.call(mockFileFixtures, metadata.fixtureId)) throw new Error('Demo 只接受内置模拟文件，不读取用户文件。')
      check(metadata.fixtureId); const fixture = mockFileFixtures[metadata.fixtureId]; const target = `${path}/${fixture.name}`; assertDestination(target)
      directory(path).files.push(entry(target, fixture.size)); return { ok: true, path: target, name: fixture.name }
    },
    filebrowserFileDownloadUrl(): string { throw new Error('模拟结果不包含真实文件，无法下载。') },
  }
}
