import { test, expect } from './fixtures'

const probeDirectory = 'unas-sp02-authorized-directory'
const probeFile = 'directory-proof.txt'
const probeFolder = 'nested'

async function installAuthorizedDirectoryPicker(page: import('@playwright/test').Page) {
  await page.evaluate(async ({ probeDirectory, probeFile, probeFolder }) => {
    const root = await navigator.storage.getDirectory()
    const directory = await root.getDirectoryHandle(probeDirectory, { create: true })
    const fileHandle = await directory.getFileHandle(probeFile, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write('uNAS SP-02 read-only directory listing proof')
    await writable.close()
    await directory.getDirectoryHandle(probeFolder, { create: true })
    Object.defineProperty(globalThis, 'showDirectoryPicker', {
      configurable: true,
      value: async (options?: { mode?: string }) => {
        Object.assign(globalThis, { unasDirectoryPickerMode: options?.mode })
        return directory
      },
    })
  }, { probeDirectory, probeFile, probeFolder })
}

test('File Manager requires an in-app confirmation before enabling write mode for a user-selected directory', async ({ extension }, testInfo) => {
  const url = 'chrome-extension://' + extension.extensionId + '/newtab.html'
  const first = await extension.context.newPage()
  await first.goto(url)
  await installAuthorizedDirectoryPicker(first)
  await first.locator('.app-icon--file-manager').click()
  const firstApp = first.locator('[data-app-id="file-manager"]')
  await expect.poll(() => first.evaluate(() => (globalThis as typeof globalThis & { unasDirectoryPickerMode?: string }).unasDirectoryPickerMode)).toBe('read')
  await expect(firstApp.getByRole('status')).toContainText('仅显示当前目录的直接子项')
  await expect(firstApp.getByRole('button', { name: '打开文件夹 nested' })).toBeVisible()
  await expect(firstApp.getByLabel('directory-proof.txt，文件条目')).toBeVisible()
  const readOnlyMode = first.getByRole('button', { name: '只读模式，点击开启写入模式' })
  await expect(readOnlyMode).toBeVisible()
  await readOnlyMode.click()
  await expect(first.getByRole('heading', { name: '开启写入模式？' })).toBeVisible()
  await first.getByRole('button', { name: '继续并授权' }).click()
  const writeMode = first.getByRole('button', { name: '写入模式已开启，点击恢复只读模式' })
  await expect(writeMode).toBeVisible()
  await expect(firstApp.getByRole('button', { name: '新建文件夹' })).toBeEnabled()
  await writeMode.click()
  await expect(first.getByRole('button', { name: '只读模式，点击开启写入模式' })).toBeVisible()
  await expect(firstApp.getByRole('button', { name: '新建文件夹' })).toBeDisabled()
  await readOnlyMode.click()
  await first.getByRole('button', { name: '继续并授权' }).click()
  await expect(writeMode).toBeVisible()
  await firstApp.getByRole('searchbox', { name: '搜索当前目录' }).fill('PROOF')
  await expect(firstApp.locator('.fm-row--local')).toHaveCount(1)
  await firstApp.getByRole('searchbox', { name: '搜索当前目录' }).fill('missing')
  await expect(firstApp).toContainText('没有匹配的项目')
  await firstApp.getByRole('button', { name: '清除搜索' }).click()
  await expect(firstApp.locator('.fm-row--local')).toHaveCount(2)
  await firstApp.getByRole('combobox', { name: '排序方式' }).selectOption('size')
  await expect(firstApp.locator('.fm-row--local').first()).toContainText('nested')
  await firstApp.getByRole('button', { name: '打开文件夹 nested' }).click()
  await expect(firstApp).toContainText('此目录为空')
  await firstApp.getByRole('button', { name: '返回上一级' }).click()
  await expect(firstApp.getByLabel('directory-proof.txt，文件条目')).toBeVisible()
  await firstApp.getByRole('button', { name: '打开文件夹 nested' }).click()
  await expect(firstApp).toContainText('此目录为空')
  await firstApp.getByRole('button', { name: '返回授权目录' }).click()
  await expect(firstApp.getByLabel('directory-proof.txt，文件条目')).toBeVisible()
  await expect(firstApp).not.toContainText('uNAS SP-02 read-only directory listing proof')
  await expect(firstApp.locator('.fm-local-heading')).toHaveCount(0)
  await expect(firstApp.getByRole('button', { name: '新建文档' })).toBeEnabled()
  const buttonIconStyles = await firstApp.locator('.fm-icon-btn > svg, .fm-action-btn > svg').evaluateAll((icons) => icons.map((icon) => {
    const style = getComputedStyle(icon)
    return { fill: style.fill, stroke: style.stroke }
  }))
  expect(buttonIconStyles).not.toHaveLength(0)
  expect(buttonIconStyles.every(({ fill, stroke }) => fill === 'none' && stroke !== 'none' && stroke !== 'rgb(0, 0, 0)')).toBe(true)
  first.once('dialog', (dialog) => dialog.accept('created-from-e2e'))
  await firstApp.getByRole('button', { name: '新建文件夹' }).click()
  await expect(firstApp.getByRole('button', { name: '打开文件夹 created-from-e2e' })).toBeVisible()
  first.once('dialog', (dialog) => dialog.accept('notes'))
  await firstApp.getByRole('button', { name: '新建文档' }).click()
  await expect(firstApp.getByLabel('notes.md，文件条目')).toBeVisible()
  await expect.poll(() => first.evaluate(async ({ probeDirectory }) => {
    const root = await navigator.storage.getDirectory()
    const directory = await root.getDirectoryHandle(probeDirectory)
    return (await (await directory.getFileHandle('notes.md')).getFile()).text()
  }, { probeDirectory })).toBe('# 新文档\n')
  const screenshotPath = testInfo.outputPath('directory-write-layout.png')
  await first.screenshot({ path: screenshotPath, animations: 'disabled' })
  await testInfo.attach('directory-write-layout', { path: screenshotPath, contentType: 'image/png' })
  for (const sample of [
    { width: 1440, height: 900, theme: 'dark' },
    { width: 1440, height: 900, theme: 'light' },
    { width: 390, height: 844, theme: 'light' },
  ]) {
    await first.setViewportSize({ width: sample.width, height: sample.height })
    await first.evaluate((theme) => document.documentElement.setAttribute('data-theme', theme), sample.theme)
    const pane = firstApp.locator('.fm-local-browser')
    expect(await pane.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
    const path = testInfo.outputPath(`directory-${sample.width}-${sample.theme}.png`)
    await first.screenshot({ path, animations: 'disabled' })
    await testInfo.attach(`directory-${sample.width}-${sample.theme}`, { path, contentType: 'image/png' })
  }
  await first.setViewportSize({ width: 1440, height: 900 })

  first.once('dialog', (dialog) => dialog.accept())
  await firstApp.getByRole('button', { name: '删除 notes.md' }).click()
  await expect(firstApp.getByLabel('notes.md，文件条目')).toHaveCount(0)

  // Picker cancellation must preserve the current valid grant rather than drop it.
  await first.evaluate(() => Object.defineProperty(globalThis, 'showDirectoryPicker', {
    configurable: true,
    value: async () => { throw new DOMException('cancelled', 'AbortError') },
  }))
  await firstApp.getByRole('button', { name: '更换目录', exact: true }).click()
  await expect(firstApp.getByRole('status')).toContainText('继续使用已有目录授权')
  await expect(firstApp.getByLabel('directory-proof.txt，文件条目')).toBeVisible()

  const reopened = await extension.context.newPage()
  await reopened.goto(url)
  await reopened.locator('.app-icon--file-manager').click()
  const reopenedApp = reopened.locator('[data-app-id="file-manager"]')
  await expect(reopenedApp.getByLabel('directory-proof.txt，文件条目')).toBeVisible()
  await expect(reopenedApp).toContainText('已恢复先前的目录授权')
  await reopenedApp.getByRole('button', { name: '忘记此目录', exact: true }).click()
  await expect(reopenedApp.getByRole('heading', { name: '打开本地目录' })).toBeVisible()
  await expect(reopenedApp).toContainText('未选择本地目录')
  const emptyScreenshotPath = testInfo.outputPath('directory-empty-layout.png')
  await reopened.screenshot({ path: emptyScreenshotPath, animations: 'disabled' })
  await testInfo.attach('directory-empty-layout', { path: emptyScreenshotPath, contentType: 'image/png' })
  expect(extension.errors).toEqual([])
  expect(extension.remoteRequests).toEqual([])
  await testInfo.attach('directory-workspace-probe', {
    body: JSON.stringify({
      handle: 'OPFS FileSystemDirectoryHandle used only by isolated E2E fixture',
      assertions: ['direct listing', 'no existing file content rendered', 'in-app confirmation before write access', 'explicit grant-scoped folder and Markdown creation', 'direct file deletion', 'picker cancellation retains grant', 'page reopen restores handle', 'forget removes saved grant'],
      manualCoverageRequired: ['native OS picker', 'actual user directory', 'browser permission revocation', 'permission denial', 'non-empty-directory deletion'],
    }, null, 2),
    contentType: 'application/json',
  })
})
