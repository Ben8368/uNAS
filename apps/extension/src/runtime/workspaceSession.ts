type LockPort = Pick<LockManager, 'request'>
/** An unavailable lock never grants ownership. Closing the page releases the lock. */
export function claimWorkspace(locks: LockPort | undefined, report: (state: 'owner' | 'conflict' | 'unavailable') => void): () => void {
  let release: (() => void) | undefined
  let stopped = false
  if (!locks) { report('unavailable'); return () => {} }
  void locks.request('unas-demo-workspace-owner-v1', { ifAvailable: true }, async (lock) => {
    if (stopped) return
    if (!lock) { report('conflict'); return }
    report('owner')
    await new Promise<void>((resolve) => { release = resolve })
  }).catch(() => { if (!stopped) report('unavailable') })
  return () => { stopped = true; release?.() }
}
