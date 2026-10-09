import { afterEach, describe, expect, it, vi } from 'vitest'
import { holdMusicStage, musicStageLock, recoverMusicStaging } from './musicStaging'
const name = 'unas-music-00000000-0000-0000-0000-000000000001.stage'
afterEach(() => vi.unstubAllGlobals())
function fixture() {
  const locks = new Set<string>()
  const removeEntry = vi.fn(async (_name: string) => {})
  vi.stubGlobal('navigator', {
    locks: { request: async (key: string, options: any, callback?: any) => {
      const run = callback ?? options
      if (locks.has(key)) return run(null)
      locks.add(key)
      try { return await run({ name: key }) } finally { locks.delete(key) }
    } },
    storage: { getDirectory: async () => ({
      async *entries() { yield [name, { kind: 'file' }]; yield ['user.txt', { kind: 'file' }]; yield ['unas-music-other.stage', { kind: 'file' }] }, removeEntry,
    }) },
  })
  return { locks, removeEntry }
}
describe('music orphan recovery', () => {
  it('finishes enumeration before deleting so a live iterator cannot skip shifted entries', async () => {
    const second = name.replace('0001.stage', '0002.stage')
    const entries = [name, second]
    const removed: string[] = []
    vi.stubGlobal('navigator', {
      locks: { request: async (_key: string, _options: unknown, run: (lock: object) => Promise<void>) => run({}) },
      storage: { getDirectory: async () => ({
        async *entries() { for (const name of entries) yield [name, { kind: 'file' }] },
        removeEntry: async (name: string) => { removed.push(name); entries.splice(entries.indexOf(name), 1) },
      }) },
    })
    await recoverMusicStaging()
    expect(removed).toEqual([name, second])
    expect(entries).toEqual([])
  })
  it('skips active output, then recovers the exact stage name after lease release', async () => {
    const { locks, removeEntry } = fixture()
    const release = await holdMusicStage(name)
    expect(locks.has(musicStageLock(name))).toBe(true)
    await recoverMusicStaging()
    expect(removeEntry).not.toHaveBeenCalled()
    await release()
    await recoverMusicStaging()
    expect(removeEntry).toHaveBeenCalledExactlyOnceWith(name)
  })
  it('reports deletion failure and retries on the next recovery', async () => {
    const { removeEntry } = fixture()
    removeEntry.mockRejectedValueOnce(new DOMException('busy', 'NoModificationAllowedError'))
    await expect(recoverMusicStaging()).rejects.toThrow('未能清理')
    await expect(recoverMusicStaging()).resolves.toBeUndefined()
    expect(removeEntry).toHaveBeenCalledTimes(2)
  })
})
