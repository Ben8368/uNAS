import { describe, expect, it, vi } from 'vitest'
import { canCloseWindow, registerWindowCloseGuard } from './windowCloseGuards'

describe('window close guards', () => {
  it('keeps a veto confined to its window and unregisters it on cleanup', () => {
    const guard = vi.fn(() => false)
    const unregister = registerWindowCloseGuard('dirty-window', guard)
    expect(canCloseWindow('other-window')).toBe(true)
    expect(canCloseWindow('dirty-window')).toBe(false)
    unregister()
    expect(canCloseWindow('dirty-window')).toBe(true)
    expect(guard).toHaveBeenCalledOnce()
  })
})
