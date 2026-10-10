import { test, expect } from './fixtures'

test('shared WebDAV persists one authentication record, configures Vault, and reuses it in Files', async ({ extension }, testInfo) => {
  const worker = extension.context.serviceWorkers()[0]
  // Synthetic DAV protocol responses; real background routing, crypto, IndexedDB and storage.
  await worker.evaluate(() => {
    const files = new Map<string, { body: ArrayBuffer; etag: string }>()
    let revision = 0
    chrome.permissions.contains = (async () => true) as typeof chrome.permissions.contains
    const original = fetch.bind(globalThis)
    globalThis.fetch = async (input, options) => {
      if (!String(input).startsWith('https://shared-fixture.example/dav/')) return original(input, options)
      const url = new URL(String(input)); const path = url.pathname
      const method = options?.method || 'GET'; const headers = new Headers(options?.headers)
      if (method === 'MKCOL') return new Response(null, { status: 201 })
      if (method === 'PUT') {
        if (files.has(path) && headers.get('If-None-Match') === '*') return new Response(null, { status: 412 })
        const etag = '"v' + (++revision) + '"'
        const body = await new Response(options?.body).arrayBuffer()
        files.set(path, { body, etag }); return new Response(null, { status: 201, headers: { ETag: etag } })
      }
      if (method === 'GET') { const file = files.get(path); return file ? new Response(file.body, { headers: { ETag: file.etag } }) : new Response(null, { status: 404 }) }
      const members = [...files].filter(([name]) => name.startsWith(path)).map(([name, file]) => '<d:response><d:href>' + name + '</d:href><d:propstat><d:prop><d:getetag>' + file.etag + '</d:getetag></d:prop></d:propstat></d:response>').join('')
      return new Response('<d:multistatus xmlns:d="DAV:">' + members + '</d:multistatus>', { status: 207 })
    }
  })
  const page = await extension.context.newPage()
  await page.goto('chrome-extension://' + extension.extensionId + '/newtab.html#settings')
  await page.evaluate(() => {
    browser.permissions.request = (async () => true) as typeof browser.permissions.request
    browser.permissions.contains = (async () => true) as typeof browser.permissions.contains
    const original = fetch.bind(globalThis)
    globalThis.fetch = async (input, options) => {
      if (!String(input).startsWith('https://shared-fixture.example/dav/')) return original(input, options)
      const entry = (name: string, directory: boolean) => '<d:response><d:href>/dav/' + name + '</d:href><d:propstat><d:prop><d:resourcetype>' + (directory ? '<d:collection/>' : '') + '</d:resourcetype><d:getcontentlength>5</d:getcontentlength><d:getetag>"v1"</d:getetag></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>'
      return new Response('<d:multistatus xmlns:d="DAV:">' + entry('', true) + entry('shared-proof.txt', false) + entry('.unas-vault/', true) + '</d:multistatus>', { status: 207 })
    }
  })
  const settings = page.locator('[data-app-id="settings"]')
  await settings.getByLabel('WebDAV 地址').fill('https://shared-fixture.example/dav/')
  await settings.getByLabel('用户名', { exact: true }).fill('shared-user')
  await settings.getByLabel('应用密码（App Password）').fill('fixture-app-password')
  await settings.getByRole('checkbox').check()
  await settings.getByRole('button', { name: '保存连接', exact: true }).click()
  await expect(settings.getByRole('status')).toContainText('密码库已自动配置')
  await expect(settings.getByLabel('Vault Key', { exact: true })).not.toHaveValue('')
  await settings.getByRole('button', { name: '已安全保存密钥' }).click()
  await expect(settings.getByLabel('应用密码（App Password）')).toHaveValue('')
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : width === 1024 ? 768 : 900 })
    await settings.locator('.settings-stage').evaluate(element => { element.scrollTop = 0 })
    await expect(settings.getByLabel('WebDAV 地址')).toBeVisible()
    expect(await settings.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    const screenshot = testInfo.outputPath('shared-settings-' + width + '.png')
    await page.screenshot({ path: screenshot, animations: 'disabled' })
    await testInfo.attach('shared-settings-' + width, { path: screenshot, contentType: 'image/png' })
    await settings.getByRole('button', { name: '更新连接', exact: true }).scrollIntoViewIfNeeded()
    await expect(settings.getByRole('button', { name: '更新连接', exact: true })).toBeInViewport()
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  const stored = await worker.evaluate(async () => {
    const values = await chrome.storage.local.get(['unas-webdav-connections-v1', 'unipass-vault-profiles', 'unipass-vault-persistent-connections'])
    const connection = values['unas-webdav-connections-v1'][0]
    return { count: values['unas-webdav-connections-v1'].length, connectionId: connection.id, vaultConnectionId: values['unipass-vault-profiles'][0].connectionId, encrypted: !JSON.stringify(values).includes('fixture-app-password'), endpoint: values['unipass-vault-profiles'][0].endpoint }
  })
  expect(stored).toMatchObject({ count: 1, encrypted: true, endpoint: 'https://shared-fixture.example/dav/.unas-vault/' })
  expect(stored.vaultConnectionId).toBe(stored.connectionId)
  await settings.getByRole('button', { name: '关闭设置' }).click()
  await expect(settings).toHaveCount(0)
  await page.locator('.app-icon--file-manager').click()
  const files = page.locator('[data-app-id="file-manager"]')
  await files.getByRole('button', { name: 'WebDAV', exact: true }).click()
  await expect(files.getByLabel('共享 WebDAV 连接')).toHaveValue(stored.connectionId)
  await files.getByRole('link', { name: '管理共享连接' }).click()
  await expect(settings.getByLabel('选择连接')).toHaveValue(stored.connectionId)
  await settings.getByRole('button', { name: '关闭设置' }).click()
  await expect(settings).toHaveCount(0)
  await files.getByRole('button', { name: '浏览文件' }).click()
  await expect(files.getByText('shared-proof.txt', { exact: true })).toBeVisible()
  await expect(files.getByRole('button', { name: '打开文件夹 .unas-vault' })).toHaveCount(0)
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : width === 1024 ? 768 : 900 })
    expect(await files.locator('.fm-workspace').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    await expect(files.getByRole('button', { name: '下载 shared-proof.txt' })).toBeVisible()
    const screenshot = testInfo.outputPath('shared-files-' + width + '.png')
    await page.screenshot({ path: screenshot, animations: 'disabled' })
    await testInfo.attach('shared-files-' + width, { path: screenshot, contentType: 'image/png' })
  }
  // A change in another top-level page invalidates the first page's existing session.
  const other = await extension.context.newPage()
  await other.goto('chrome-extension://' + extension.extensionId + '/newtab.html')
  const removed = await other.evaluate(async id => await browser.runtime.sendMessage({ kind: 'webdav.connection', version: 1, action: 'remove', input: { id } }), stored.connectionId)
  expect(removed).toEqual({ ok: true })
  await page.bringToFront()
  await files.getByRole('button', { name: '刷新', exact: true }).click()
  await expect(files.getByRole('alert')).toContainText('已移除')
  expect(extension.errors).toEqual([])
  expect(extension.remoteRequests).toEqual([])
})
