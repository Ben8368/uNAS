const stagingName = /^unas-music-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.stage$/i
export const musicStageLock = (name: string) => `unas-music-stage:${name}`

export async function holdMusicStage(name: string): Promise<() => Promise<void>> {
  let release!: () => void
  let acquired!: () => void
  let failed!: (error: unknown) => void
  const ready = new Promise<void>((resolve, reject) => { acquired = resolve; failed = reject })
  const held = new Promise<void>(resolve => { release = resolve })
  const request = navigator.locks.request(musicStageLock(name), async () => { acquired(); await held })
  void request.catch(failed)
  await ready
  return async () => { release(); await request }
}

/** A crashed page releases its Web Locks. A live result keeps its lock until cleanup. */
export async function recoverMusicStaging(): Promise<void> {
  if (typeof navigator.locks?.request !== 'function' || typeof navigator.storage?.getDirectory !== 'function') return
  const root = await navigator.storage.getDirectory() as FileSystemDirectoryHandle & { entries(): AsyncIterableIterator<[string, FileSystemHandle]> }
  const names: string[] = []
  for await (const [name, entry] of root.entries()) {
    if (entry.kind === 'file' && stagingName.test(name)) names.push(name)
  }
  let failures = 0
  for (const name of names) {
    await navigator.locks.request(musicStageLock(name), { ifAvailable: true }, async lock => {
      if (!lock) return
      try { await root.removeEntry(name) }
      catch (error) { if (!(error instanceof DOMException && error.name === 'NotFoundError')) failures++ }
    })
  }
  if (failures) throw new Error(`有 ${failures} 个历史音乐暂存未能清理，请稍后重新打开音乐应用重试。`)
}
