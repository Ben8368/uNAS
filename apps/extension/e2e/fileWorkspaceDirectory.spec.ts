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
      value: async () => directory,
    })
  }, { probeDirectory, probeFile, probeFolder })
}

test('File Manager persists a user-selected directory handle, writes only from its grant, retains it after cancellation, and forgets it', async ({ extension }, testInfo) => {
  const url = 'chrome-extension://' + extension.extensionId + '/newtab.html'
  const first = await extension.context.newPage()
  await first.goto(url)
  await installAuthorizedDirectoryPicker(first)
  await first.locator('.app-icon--file-manager').click()
  const firstApp = first.locator('[data-app-id="file-manager"]')
  await expect(firstApp.getByRole('status')).toContainText('仅显示当前目录的直接子项')
  await expect(firstApp.getByRole('button', { name: '打开文件夹 nested' })).toBeVisible()
  await expect(firstApp.getByLabel('directory-proof.txt，文件条目')).toBeVisible()
  await expect(firstApp).not.toContainText('uNAS SP-02 read-only directory listing proof')
  await expect(firstApp.getByRole('button', { name: '新建文件夹' })).toBeEnabled()
  const buttonIconStyles = await firstApp.locator('.fm-icon-btn > svg, .fm-action-btn > svg').evaluateAll((icons) => icons.map((icon) => {
    const style = getComputedStyle(icon)
    return { fill: style.fill, stroke: style.stroke }
  }))
  expect(buttonIconStyles).not.toHaveLength(0)
  expect(buttonIconStyles.every(({ fill, stroke }) => fill === 'none' && stroke !== 'none' && stroke !== 'rgb(0, 0, 0)')).toBe(true)
  for (const label of ['新建文件夹', '新建文档']) {
    const button = firstApp.getByRole('button', { name: label })
    const icon = button.locator('> svg')
    const [buttonBox, iconBox] = await Promise.all([button.boundingBox(), icon.boundingBox()])
    expect(buttonBox).not.toBeNull()
    expect(iconBox).not.toBeNull()
    expect(Math.abs((buttonBox!.y + buttonBox!.height / 2) - (iconBox!.y + iconBox!.height / 2))).toBeLessThanOrEqual(1)
  }

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
  await expect(reopenedApp.getByRole('heading', { name: '选择本地目录' })).toBeVisible()
  await expect(reopenedApp).toContainText('未删除任何本地文件')
  expect(extension.errors).toEqual([])
  expect(extension.remoteRequests).toEqual([])
  await testInfo.attach('directory-workspace-probe', {
    body: JSON.stringify({
      handle: 'OPFS FileSystemDirectoryHandle used only by isolated E2E fixture',
      assertions: ['direct listing', 'no existing file content rendered', 'explicit grant-scoped folder and Markdown creation', 'direct file deletion', 'picker cancellation retains grant', 'page reopen restores handle', 'forget removes saved grant'],
      manualCoverageRequired: ['native OS picker', 'actual user directory', 'browser permission revocation', 'permission denial', 'non-empty-directory deletion'],
    }, null, 2),
    contentType: 'application/json',
  })
})
