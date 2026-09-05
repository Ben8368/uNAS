import { describe, expect, it, vi } from 'vitest'
import { claimWorkspace } from './workspaceSession'

function lockPort() {
  let held = false
  const request = vi.fn(async (_name, _options, callback) => {
    if (held) return callback(null)
    held = true
    try { await callback({ name: 'workspace', mode: 'exclusive' }) }
    finally { held = false }
  })
  return { port: { request } as unknown as Pick<LockManager, 'request'>, request }
}

describe('Workspace ownership setup', () => {
  it('skips the discarded StrictMode setup and acquires once for the surviving setup', async () => {
    const { port, request } = lockPort()
    const discarded = vi.fn(); const surviving = vi.fn()
    claimWorkspace(port, discarded)()
    const release = claimWorkspace(port, surviving)
    await Promise.resolve()
    expect(request).toHaveBeenCalledOnce()
    expect(discarded).not.toHaveBeenCalled()
    expect(surviving).toHaveBeenCalledWith('owner')
    release()
  })

  it('rejects a second live owner and lets it retry after release', async () => {
    const { port } = lockPort()
    const release = claimWorkspace(port, vi.fn())
    await Promise.resolve()
    const second = vi.fn()
    const disposeSecond = claimWorkspace(port, second)
    await Promise.resolve()
    expect(second).toHaveBeenLastCalledWith('conflict')
    disposeSecond(); release()
    await Promise.resolve(); await Promise.resolve()
    const disposeRetry = claimWorkspace(port, second)
    await Promise.resolve()
    expect(second).toHaveBeenLastCalledWith('owner')
    disposeRetry()
  })

  it('reports unavailable locks without granting ownership', () => {
    const report = vi.fn()
    claimWorkspace(undefined, report)()
    expect(report).toHaveBeenCalledWith('unavailable')
  })
})
