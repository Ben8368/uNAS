import { afterEach, describe, expect, it, vi } from 'vitest'
import { installToolbarAction } from './extensionAdapter'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('toolbar action', () => {
  it('opens an active desktop tab on every click', async () => {
    const addListener = vi.fn()
    const create = vi.fn().mockResolvedValue({ id: 1, windowId: 1 })
    vi.stubGlobal('chrome', {
      runtime: { id: 'unas', getURL: (path: string) => `chrome-extension://unas${path}` },
      action: { onClicked: { addListener } }, tabs: { create },
    })
    installToolbarAction()
    const click = addListener.mock.calls[0][0] as () => Promise<void>
    await click(); await click()
    expect(create).toHaveBeenCalledTimes(2)
    expect(create).toHaveBeenCalledWith({ url: 'chrome-extension://unas/newtab.html', active: true })
    create.mockRejectedValueOnce(new Error('tab unavailable'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(click()).resolves.toBeUndefined()
    expect(log).toHaveBeenCalled()
  })
  it('does not install an action outside an extension', () => {
    vi.stubGlobal('chrome', undefined)
    expect(installToolbarAction).not.toThrow()
  })
})
