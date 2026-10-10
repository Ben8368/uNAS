import { afterEach, describe, expect, it, vi } from 'vitest'
import * as adblock from 'unas-src/features/adblock/background/service-worker'
import { installWorkspaceRouter } from './router'

const extensionPage = { id: 'unas', url: 'chrome-extension://unas/newtab.html', frameId: 0 }
const webPage = { id: 'unas', url: 'https://example.com/', frameId: 0, tab: { id: 7 } }
const foreignExtension = { id: 'other', url: 'chrome-extension://other/newtab.html', frameId: 0 }
const INVALID_SOURCE = '消息来源、版本或动作无效。'

function install(browser: Record<string, unknown> = {}) {
  let listener: (message: unknown, sender: unknown) => Promise<unknown> = async () => undefined
  vi.stubGlobal('browser', { runtime: { id: 'unas', getURL: (path: string) => `chrome-extension://unas/${path}`, onMessage: { addListener: (fn: typeof listener) => { listener = fn } } }, ...browser })
  installWorkspaceRouter()
  return (message: unknown, sender: unknown) => listener(message, sender)
}

describe('extension message router', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('opens the Password Manager page only for top-level uNAS pages', async () => {
    const create = vi.fn(async () => undefined)
    const send = install({ tabs: { create } })
    await expect(send({ kind: 'password-manager.open' }, webPage)).resolves.toEqual({ ok: false, error: '密码管家入口来源无效。' })
    await expect(send({ kind: 'password-manager.open' }, foreignExtension)).resolves.toEqual({ ok: false, error: '密码管家入口来源无效。' })
    expect(create).not.toHaveBeenCalled()
    await expect(send({ kind: 'password-manager.open' }, extensionPage)).resolves.toEqual({ ok: true })
    expect(create).toHaveBeenCalledWith({ url: 'chrome-extension://unas/manage.html', active: true })
  })

  it('answers a matching but unauthorized AdBlock or Password Manager message with an explicit error', async () => {
    const send = install()
    const childFrame = { ...webPage, frameId: 3 }
    // Web pages (top-level or child frames) may send only the exact cosmetic-rules request; anything else is rejected before dispatch.
    await expect(send({ type: 'getBlockingStatus' }, childFrame)).resolves.toEqual({ ok: false, error: '广告拦截消息来源无效。' })
    await expect(send({ type: 'getBlockingStatus' }, webPage)).resolves.toEqual({ ok: false, error: '广告拦截消息来源无效。' })
    await expect(send({ type: 'pauseBlockingForSite' }, webPage)).resolves.toEqual({ ok: false, error: '广告拦截消息来源无效。' })
    await expect(send({ type: 'refreshBlockingSubscriptions' }, webPage)).resolves.toEqual({ ok: false, error: '广告拦截消息来源无效。' })
    await expect(send({ type: 'getCosmeticRules', extra: true }, childFrame)).resolves.toEqual({ ok: false, error: '广告拦截消息来源无效。' })
    await expect(send({ type: 'getBlockingStatus' }, foreignExtension)).resolves.toEqual({ ok: false, error: '广告拦截消息来源无效。' })
    await expect(send({ type: 'session' }, foreignExtension)).resolves.toEqual({ ok: false, error: '密码管家消息来源无效。' })
    await expect(send({ type: 'session' }, { ...webPage, id: 'other' })).resolves.toEqual({ ok: false, error: '密码管家消息来源无效。' })
  })

  it('dispatches an authorized message to the owning feature handler with the original sender', async () => {
    const send = install()
    const childFrame = { ...webPage, frameId: 3 }
    const handled = vi.spyOn(adblock, 'handleAdBlockMessage').mockResolvedValue({ ok: true, data: 'rules' })
    await expect(send({ type: 'getCosmeticRules' }, childFrame)).resolves.toEqual({ ok: true, data: 'rules' })
    expect(handled).toHaveBeenCalledWith({ type: 'getCosmeticRules' }, childFrame)
  })

  it('lets unauthorized download and Link App messages fall through without touching Chrome', async () => {
    const search = vi.fn(); const download = vi.fn()
    const send = install({ downloads: { search, download, cancel: vi.fn() } })
    for (const sender of [webPage, foreignExtension]) {
      await expect(send({ kind: 'browser.download.list' }, sender)).resolves.toEqual({ ok: false, error: INVALID_SOURCE })
      await expect(send({ kind: 'browser.downloads.files.list' }, sender)).resolves.toEqual({ ok: false, error: INVALID_SOURCE })
      await expect(send({ kind: 'browser.download', url: 'https://example.com/a.zip' }, sender)).resolves.toEqual({ ok: false, error: INVALID_SOURCE })
    }
    expect(search).not.toHaveBeenCalled(); expect(download).not.toHaveBeenCalled()
  })

  it('rejects unknown and malformed messages from every source', async () => {
    const send = install()
    for (const message of [undefined, null, 'session', [], {}, { kind: 'browser.download', url: 'javascript:alert(1)' }, { kind: 'browser.download.cancel', downloadId: -1 }]) {
      await expect(send(message, extensionPage)).resolves.toEqual({ ok: false, error: INVALID_SOURCE })
    }
  })

  it('does not register a listener without an extension runtime', () => {
    const addListener = vi.fn()
    vi.stubGlobal('browser', { runtime: { onMessage: { addListener } } })
    installWorkspaceRouter()
    expect(addListener).not.toHaveBeenCalled()
  })
})
