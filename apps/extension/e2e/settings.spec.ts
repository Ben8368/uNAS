import { test, expect } from './fixtures'

test('设置直接显示 WebDAV，切换桌面外观保留连接输入', async ({ extension }, testInfo) => {
  const page = await extension.context.newPage()
  await page.goto(`chrome-extension://${extension.extensionId}/newtab.html`)
  await page.getByRole('navigation', { name: '桌面导航' }).getByRole('button', { name: '设置', exact: true }).click()
  const settings = page.locator('[data-app-id="settings"]')
  await expect(settings.getByRole('navigation', { name: '设置分类' })).toBeVisible()
  await expect(settings.getByRole('button', { name: '外观', exact: true })).toHaveCount(0)
  await settings.getByRole('button', { name: 'WebDAV', exact: true }).click()
  await expect(settings.getByRole('heading', { name: '连接 WebDAV', exact: true })).toBeVisible()
  const endpoint = settings.getByLabel('WebDAV 地址')
  await expect(endpoint).toBeEnabled()
  await endpoint.fill('http://invalid.example/dav')
  await settings.getByLabel('用户名', { exact: true }).fill('fixture-user')
  await settings.getByLabel('应用密码（App Password）').fill('fixture-password')
  await settings.getByRole('checkbox').check()
  await settings.getByRole('button', { name: '保存连接', exact: true }).click()
  await expect(settings.getByRole('alert')).toContainText('HTTPS')
  await endpoint.fill('https://nas.example.com/dav/')
  await settings.getByLabel('应用密码（App Password）').fill('fixture-password')
  await page.getByRole('button', { name: /^切换外观/ }).click()
  await settings.getByRole('button', { name: 'WebDAV', exact: true }).click()
  await expect(endpoint).toHaveValue('https://nas.example.com/dav/')
  await expect(settings.getByLabel('应用密码（App Password）')).toHaveValue('fixture-password')
  // Clear the fixture password before retaining screenshot evidence.
  await settings.getByLabel('应用密码（App Password）').fill('')
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : width === 1024 ? 768 : 900 })
    await expect(settings.getByRole('button', { name: 'WebDAV', exact: true })).toBeVisible()
    await expect(endpoint).toBeVisible()
    expect(await settings.locator('.settings-stage').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    await testInfo.attach(`settings-webdav-${width}`, { body: await page.screenshot(), contentType: 'image/png' })
  }
  expect(extension.errors).toEqual([])
})

test('WebDAV 设置通过受控消息保存、重连与移除，成功后清空秘密输入', async ({ extension }) => {
  const page = await extension.context.newPage()
  await page.goto(`chrome-extension://${extension.extensionId}/newtab.html`)
  // Controlled service responses verify the UI lifecycle only, not NAS compatibility.
  await page.evaluate(() => {
    const original = browser.runtime.sendMessage.bind(browser.runtime)
    const connection = { id: 'settings-fixture', name: '测试共享连接', endpoint: 'https://nas.example.com/dav/', revision: 'v1', vaultEndpoint: 'https://nas.example.com/dav/.unas-vault/' }
    browser.permissions.request = (async () => true) as typeof browser.permissions.request
    browser.runtime.sendMessage = (async (message: { kind?: string; action?: string; input?: { id?: string } }) => {
      if (message.kind !== 'webdav.connection') return original(message)
      if (message.action === 'list') return { ok: true, data: [] }
      if (message.action === 'save') return { ok: true, data: { connection, vaultReady: true, recoveryKey: message.input?.id ? undefined : 'fixture-recovery-key' } }
      return { ok: true }
    }) as typeof browser.runtime.sendMessage
  })
  await page.getByRole('navigation', { name: '桌面导航' }).getByRole('button', { name: '设置', exact: true }).click()
  const settings = page.locator('[data-app-id="settings"]')
  await settings.getByRole('button', { name: 'WebDAV', exact: true }).click()
  await settings.getByLabel('用户名', { exact: true }).fill('fixture-user')
  await settings.getByRole('checkbox').check()
  await settings.getByLabel('WebDAV 地址').fill('https://nas.example.com/dav/')
  await settings.getByLabel('应用密码（App Password）').fill('fixture-password')
  await settings.getByRole('button', { name: '保存连接', exact: true }).click()
  await expect(settings.getByLabel('Vault Key', { exact: true })).toHaveValue('fixture-recovery-key')
  await expect(settings.getByLabel('应用密码（App Password）')).toHaveValue('')
  await page.getByRole('button', { name: /^切换外观/ }).click()
  await settings.getByRole('button', { name: 'WebDAV', exact: true }).click()
  await expect(settings.getByLabel('Vault Key', { exact: true })).toHaveValue('fixture-recovery-key')
  await settings.getByRole('button', { name: '已安全保存密钥' }).click()
  await expect(settings.getByLabel('Vault Key', { exact: true })).toHaveCount(0)
  await settings.getByLabel('应用密码（App Password）').fill('fixture-reconnect-password')
  await settings.getByRole('button', { name: '更新连接', exact: true }).click()
  await expect(settings.getByRole('status')).toContainText('连接已保存')
  await expect(settings.getByLabel('应用密码（App Password）')).toHaveValue('')
  page.once('dialog', (dialog) => dialog.accept())
  await settings.getByRole('button', { name: '移除连接', exact: true }).click()
  await expect(settings.getByLabel('选择连接')).toHaveValue('')
  await expect(settings.getByLabel('WebDAV 地址')).toHaveValue('')
  await expect(settings.getByRole('status')).toContainText('连接已移除')
  expect(extension.errors).toEqual([])
})

test('桌面外观按钮循环六款配色并在刷新后保留，窄屏可通过键盘切换', async ({ extension }, testInfo) => {
  const page = await extension.context.newPage()
  await page.goto(`chrome-extension://${extension.extensionId}/newtab.html`)
  const toggle = page.getByRole('navigation', { name: '桌面导航' }).getByRole('button', { name: /^切换外观/ })
  const original = await page.locator('html').evaluate((element) => element.style.getPropertyValue('--mt-wp-srgb'))
  for (const name of ['沙丘', '远山', '石墨', '深海', '暮光', '极光']) {
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-label', new RegExp(`当前${name}`))
  }
  expect(await page.locator('html').evaluate((element) => element.style.getPropertyValue('--mt-wp-srgb'))).toBe(original)
  await toggle.click()
  const selected = await page.locator('html').evaluate((element) => element.style.getPropertyValue('--mt-wp-srgb'))
  expect(selected).not.toBe(original)
  await page.reload()
  await expect(toggle).toHaveAttribute('aria-label', /当前沙丘/)
  expect(await page.locator('html').evaluate((element) => element.style.getPropertyValue('--mt-wp-srgb'))).toBe(selected)
  await page.setViewportSize({ width: 390, height: 844 })
  await toggle.focus()
  await page.keyboard.press('Enter')
  await expect(toggle).toHaveAttribute('aria-label', /当前远山/)
  const box = await toggle.boundingBox()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(390)
  await testInfo.attach('compact-appearance-toggle', { body: await page.screenshot(), contentType: 'image/png' })
  expect(extension.errors).toEqual([])
})
