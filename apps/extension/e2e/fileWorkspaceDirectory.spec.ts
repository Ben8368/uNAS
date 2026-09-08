import { test, expect } from './fixtures'

const probeDirectory = 'unas-sp02-authorized-directory'
const probeFile = 'read-only-proof.txt'
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

test('File Manager persists a user-selected read-only directory handle, restores it, retains it after cancellation, and forgets it', async ({ extension }, testInfo) => {
  const url = 'chrome-extension://' + extension.extensionId + '/newtab.html'
  const first = await extension.context.newPage()
  await first.goto(url)
  await installAuthorizedDirectoryPicker(first)
  await first.locator('.app-icon--file-manager').click()
  const firstApp = first.locator('[data-app-id="file-manager"]')
  await expect(firstApp.getByRole('status')).toContainText('仅显示当前目录的直接子项')
  await expect(firstApp.getByRole('button', { name: '打开文件夹 nested' })).toBeVisible()
  await expect(firstApp.getByLabel('read-only-proof.txt，只读文件条目')).toBeVisible()
  await expect(firstApp).not.toContainText('uNAS SP-02 read-only directory listing proof')

  // Picker cancellation must preserve the current valid grant rather than drop it.
  await first.evaluate(() => Object.defineProperty(globalThis, 'showDirectoryPicker', {
    configurable: true,
    value: async () => { throw new DOMException('cancelled', 'AbortError') },
  }))
  await firstApp.getByRole('button', { name: '更换目录', exact: true }).click()
  await expect(firstApp.getByRole('status')).toContainText('继续使用已有只读授权')
  await expect(firstApp.getByLabel('read-only-proof.txt，只读文件条目')).toBeVisible()

  const reopened = await extension.context.newPage()
  await reopened.goto(url)
  await reopened.locator('.app-icon--file-manager').click()
  const reopenedApp = reopened.locator('[data-app-id="file-manager"]')
  await expect(reopenedApp.getByLabel('read-only-proof.txt，只读文件条目')).toBeVisible()
  await expect(reopenedApp).toContainText('已授权只读目录')
  await reopenedApp.getByRole('button', { name: '忘记此目录', exact: true }).click()
  await expect(reopenedApp.getByRole('heading', { name: '选择本地目录' })).toBeVisible()
  await expect(reopenedApp).toContainText('未删除任何本地文件')
  expect(extension.errors).toEqual([])
  expect(extension.remoteRequests).toEqual([])
  await testInfo.attach('directory-workspace-probe', {
    body: JSON.stringify({
      handle: 'OPFS FileSystemDirectoryHandle used only by isolated E2E fixture',
      assertions: ['read-only direct listing', 'no file content rendered', 'picker cancellation retains grant', 'page reopen restores handle', 'forget removes saved grant'],
      manualCoverageRequired: ['native OS picker', 'actual user directory', 'browser permission revocation'],
    }, null, 2),
    contentType: 'application/json',
  })
})
