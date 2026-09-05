type LockPort = Pick<LockManager, 'request'>
/** An unavailable lock never grants ownership. Closing the page releases the lock. */
export function claimWorkspace(locks: LockPort | undefined, report: (state: 'owner' | 'conflict' | 'unavailable') => void): () => void {
  let release: (() => void) | undefined
  let stopped = false
  if (!locks) { report('unavailable'); return () => {} }
  // Skip React StrictMode's synchronously discarded setup before acquiring a lock.
  queueMicrotask(() => {
    if (stopped) return
    void locks.request('unas-demo-workspace-owner-v1', { ifAvailable: true }, async (lock) => {
      if (stopped) return
      if (!lock) { report('conflict'); return }
      const held = new Promise<void>((resolve) => { release = resolve })
      report('owner')
      await held
    }).catch(() => { if (!stopped) report('unavailable') })
  })
  return () => { stopped = true; release?.() }
}
