import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'

async function connectSyntheticDav(page: Page, extension: { extensionId: string; context: import('@playwright/test').BrowserContext }) {
  const { extensionId } = extension
  await page.goto(`chrome-extension://${extensionId}/newtab.html`)
  await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 1; canvas.height = 1
    canvas.getContext('2d')!.fillRect(0, 0, 1, 1)
    const png = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), 'image/png'))
    const image = new Uint8Array(3 * 1024 * 1024)
    image.set(new Uint8Array(await png.arrayBuffer()))
    const encoder = new TextEncoder()
    const files = new Map<string, { bytes: Uint8Array; version: number }>([
      ['readme.md', { bytes: encoder.encode('# original\n'), version: 1 }],
      ['next.md', { bytes: encoder.encode('# next document\n'), version: 1 }],
      ['large.png', { bytes: image, version: 1 }],
      ['huge.md', { bytes: encoder.encode('['.repeat(2 * 1024 * 1024)), version: 1 }],
      ['oversized.txt', { bytes: encoder.encode('x'.repeat(3 * 1024 * 1024)), version: 1 }],
    ])
    const state = { saveMode: 'ready', releaseSave: undefined as (() => void) | undefined, requests: [] as Array<{ name: string; range: string | null; match: string | null; method: string }> }
    Object.assign(globalThis, { previewSafetyProbe: state })
    browser.permissions.request = (async () => true) as typeof browser.permissions.request
    browser.permissions.contains = (async () => true) as typeof browser.permissions.contains
    const originalFetch = globalThis.fetch.bind(globalThis)
    globalThis.fetch = async (input, options) => {
      if (!String(input).startsWith('https://dav-preview.example/files/')) return originalFetch(input, options)
      const name = decodeURIComponent(new URL(String(input)).pathname.slice('/files/'.length))
      const method = options?.method ?? 'GET'
      const headers = new Headers(options?.headers)
      state.requests.push({ name, method, range: headers.get('Range'), match: headers.get('If-Match') })
      if (method === 'PROPFIND') {
        const entry = (name: string, size: number, version: number, directory = false) => `<d:response><d:href>/files/${name}</d:href><d:propstat><d:prop><d:resourcetype>${directory ? '<d:collection/>' : ''}</d:resourcetype><d:getcontentlength>${size}</d:getcontentlength><d:getetag>&quot;v${version}&quot;</d:getetag></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`
        const entries = entry('', 0, 1, true) + [...files].map(([name, file]) => entry(name, file.bytes.length, file.version)).join('')
        return new Response(`<d:multistatus xmlns:d="DAV:">${entries}</d:multistatus>`, { status: 207 })
      }
      const file = files.get(name)
      if (!file) return new Response(null, { status: 404 })
      if (method === 'PUT') {
        if (state.saveMode === 'conflict' || headers.get('If-Match') !== `"v${file.version}"`) return new Response(null, { status: 412 })
        if (state.saveMode === 'pending') await new Promise<void>(resolve => { state.releaseSave = resolve })
        file.bytes = new Uint8Array(options!.body as ArrayBuffer)
        file.version += 1
        return new Response(null, { status: 204, headers: { ETag: `"v${file.version}"` } })
      }
      const match = headers.get('Range')?.match(/^bytes=(\d+)-(\d+)$/)
      if (!match) return new Response(file.bytes.slice().buffer as ArrayBuffer)
      const start = Number(match[1]), end = Math.min(Number(match[2]), file.bytes.length - 1)
      return new Response(file.bytes.slice(start, end + 1).buffer as ArrayBuffer, { status: 206, headers: {
        'Content-Range': `bytes ${start}-${end}/${file.bytes.length}`, 'Content-Length': String(end - start + 1), ETag: `"v${file.version}"`,
      } })
    }
  })
  const worker = extension.context.serviceWorkers()[0]
  await worker.evaluate(() => {
    const originalFetch = globalThis.fetch.bind(globalThis)
    globalThis.fetch = async (input, options) => String(input).startsWith('https://dav-preview.example/files/')
      ? new Response('<d:multistatus xmlns:d="DAV:"></d:multistatus>', { status: 207 })
      : originalFetch(input, options)
    chrome.permissions.contains = (async () => true) as typeof chrome.permissions.contains
  })
  await page.evaluate(() => { location.hash = '#settings' })
  const settings = page.locator('[data-app-id="settings"]')
  await settings.getByLabel('WebDAV 地址').fill('https://dav-preview.example/files/')
  await settings.getByLabel('用户名', { exact: true }).fill('synthetic-user')
  await settings.getByLabel('应用密码（App Password）').fill('synthetic-password')
  await settings.getByRole('checkbox').check()
  await settings.getByRole('button', { name: '保存连接', exact: true }).click()
  await expect(settings.getByRole('alert')).toContainText('WebDAV 连接已保存')
  await settings.getByRole('button', { name: '关闭设置' }).click()
  await page.locator('.app-icon--file-manager').click()
  const app = page.locator('[data-app-id="file-manager"]')
  await app.getByRole('navigation', { name: '文件位置' }).getByRole('button', { name: 'WebDAV', exact: true }).click()
  await app.getByRole('button', { name: '浏览文件' }).click()
  await expect(app.getByRole('button', { name: '预览 readme.md', exact: true })).toBeVisible()
  return app
}

test('local deletion preserves exact names and switching locations preserves child routes and references', async ({ extension }) => {
  const page = await extension.context.newPage()
  await page.goto(`chrome-extension://${extension.extensionId}/newtab.html`)
  await page.evaluate(async () => {
    const directory = await (await navigator.storage.getDirectory()).getDirectoryHandle('unas-review-safety', { create: true })
    for (const name of [' report.txt ', 'report.txt']) {
      const writer = await (await directory.getFileHandle(name, { create: true })).createWritable()
      await writer.write(name); await writer.close()
    }
    const child = await directory.getDirectoryHandle('child', { create: true })
    const writer = await (await child.getFileHandle('child.txt', { create: true })).createWritable()
    await writer.write('child preview'); await writer.close()
    Object.defineProperty(globalThis, 'showDirectoryPicker', { configurable: true, value: async () => directory })
  })
  await page.locator('.app-icon--file-manager').click()
  const app = page.locator('[data-app-id="file-manager"]')
  await page.getByRole('button', { name: '选择本地目录并打开系统目录选择器' }).click()
  await page.getByRole('button', { name: '只读模式，点击开启写入模式' }).click()
  await page.getByRole('button', { name: '继续并授权' }).click()
  const spacedRow = app.locator('.fm-row--local').filter({ has: page.locator('.fm-local-entry[title=" report.txt "]') })
  page.once('dialog', dialog => dialog.accept())
  await spacedRow.getByRole('button', { name: /^删除/ }).click()
  await expect(spacedRow).toHaveCount(0)
  expect(await page.evaluate(async () => {
    const directory = await (await navigator.storage.getDirectory()).getDirectoryHandle('unas-review-safety')
    return (await (await directory.getFileHandle('report.txt')).getFile()).text()
  })).toBe('report.txt')
  await app.getByRole('button', { name: '打开文件夹 child' }).click()
  await app.getByRole('button', { name: '预览文件' }).click()
  await expect(app.locator('.fm-preview')).toContainText('child preview')
  const nav = app.getByRole('navigation', { name: '文件位置' })
  await nav.getByRole('button', { name: '下载', exact: true }).click()
  await nav.getByRole('button', { name: '本地文件', exact: true }).click()
  await expect(app.getByRole('button', { name: 'child.txt，文件条目' })).toBeVisible()
  await expect(page.getByRole('button', { name: '写入模式已开启，点击恢复只读模式' })).toBeVisible()
  const download = page.waitForEvent('download')
  await app.locator('.fm-preview').getByRole('button', { name: '下载 / 导出' }).click()
  expect((await download).suggestedFilename()).toBe('child.txt')
  expect(extension.errors).toEqual([])
  expect(extension.remoteRequests).toEqual([])
})

test('unsaved WebDAV edits survive cancelled close, replacement and disconnect; saves protect the editor', async ({ extension }) => {
  const page = await extension.context.newPage()
  const app = await connectSyntheticDav(page, extension)
  await app.getByRole('button', { name: '预览 readme.md', exact: true }).click()
  const panel = app.locator('.fm-preview')
  await panel.getByRole('button', { name: '编辑', exact: true }).click()
  const editor = panel.getByRole('textbox', { name: '编辑文本' })
  await editor.fill('# unsaved')
  for (const action of [
    () => panel.getByRole('button', { name: '关闭预览' }).click(),
    () => app.getByRole('button', { name: '预览 next.md', exact: true }).click(),
    () => app.getByRole('button', { name: '断开连接' }).click(),
    () => app.getByRole('button', { name: '关闭文件管理', exact: true }).click(),
  ]) {
    const dialog = page.waitForEvent('dialog')
    const clicked = action()
    expect((await dialog).message()).toContain('尚未保存')
    await (await dialog).dismiss(); await clicked
    await expect(editor).toHaveValue('# unsaved')
  }
  expect(await page.evaluate(() => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented })).toBe(true)
  page.once('dialog', dialog => dialog.accept())
  await app.getByRole('button', { name: '预览 next.md', exact: true }).click()
  await expect(panel).toContainText('next document')
  await expect(editor).toHaveCount(0)
  await panel.getByRole('button', { name: '关闭预览' }).click()
  await app.getByRole('button', { name: '预览 readme.md', exact: true }).click()
  await panel.getByRole('button', { name: '编辑', exact: true }).click()
  await editor.fill('# saved')
  await page.evaluate(() => { (globalThis as any).previewSafetyProbe.saveMode = 'pending' })
  await panel.getByRole('button', { name: '保存', exact: true }).click()
  await expect(editor).toBeDisabled()
  await expect(panel.getByRole('button', { name: '关闭预览' })).toBeDisabled()
  await app.getByRole('button', { name: '预览 next.md', exact: true }).click()
  await expect(panel).toContainText('正在保存，请等待结果')
  await app.getByRole('button', { name: '关闭文件管理', exact: true }).click()
  await expect(app).toBeVisible()
  await page.evaluate(() => { (globalThis as any).previewSafetyProbe.releaseSave() })
  await expect(panel).toContainText('保存成功')
  expect(await page.evaluate(() => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented })).toBe(false)
  await panel.getByRole('button', { name: '编辑', exact: true }).click()
  await editor.fill('# conflicted edit')
  await page.evaluate(() => { (globalThis as any).previewSafetyProbe.saveMode = 'conflict' })
  await panel.getByRole('button', { name: '保存', exact: true }).click()
  await expect(panel).toContainText('保存失败')
  await expect(editor).toHaveValue('# conflicted edit')
  page.once('dialog', dialog => dialog.accept())
  await panel.getByRole('button', { name: '关闭预览' }).click()
  await expect(panel).toHaveCount(0)
  await app.getByRole('button', { name: '关闭文件管理', exact: true }).click()
  await expect(app).toHaveCount(0)
  expect(extension.errors).toEqual([])
  expect(extension.remoteRequests).toEqual([])
})

test('WebDAV previews sniff images without MIME, keep text limits and render large Markdown as plain text', async ({ extension }, testInfo) => {
  const page = await extension.context.newPage()
  const app = await connectSyntheticDav(page, extension)
  await app.getByRole('button', { name: '预览 large.png', exact: true }).click()
  const panel = app.locator('.fm-preview')
  await expect(panel.getByRole('img')).toBeVisible()
  await expect.poll(() => panel.getByRole('img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1)
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    expect(await panel.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
    const path = testInfo.outputPath(`preview-${viewport.width}.png`)
    await page.screenshot({ path, animations: 'disabled' })
    await testInfo.attach(`preview-${viewport.width}`, { path, contentType: 'image/png' })
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await panel.getByRole('button', { name: '关闭预览' }).click()
  await app.getByRole('button', { name: '预览 oversized.txt', exact: true }).click()
  await expect(panel.getByRole('alert')).toContainText('上限')
  const ranges = await page.evaluate(() => ((globalThis as any).previewSafetyProbe.requests as Array<{ name: string; range: string | null }>).filter(item => item.name === 'oversized.txt').map(item => item.range))
  expect(ranges).toEqual(['bytes=0-0', 'bytes=0-15'])
  await panel.getByRole('button', { name: '关闭预览' }).click()
  await app.getByRole('button', { name: '预览 huge.md', exact: true }).click()
  await expect(panel).toContainText('已按纯文本显示')
  expect(await panel.locator('pre').textContent()).toHaveLength(2 * 1024 * 1024)
  await panel.getByRole('button', { name: '关闭预览' }).click()
  expect(extension.errors).toEqual([])
  expect(extension.remoteRequests).toEqual([])
})
