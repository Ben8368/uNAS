import { test, expect } from './fixtures'

const probeDirectory = 'unas-sp04-archive-directory'
const archiveName = 'fixture.zip'
const zipFixtureBase64 = 'UEsDBBQACAgIACSAKl0AAAAAAAAAAAAAAAAQAAkAbmVzdGVkL2hlbGxvLnR4dFVUBQABw2Oiaiv1cwxWiPIMUEitKClKTC7JzM9TSMusKCktSgUAUEsHCIl6A/AdAAAAGwAAAFBLAQIAAxQACAgIACSAKl2JegPwHQAAABsAAAAQAAkAAAAAAAAAAACkgQAAAABuZXN0ZWQvaGVsbG8udHh0VVQFAAHDY6JqUEsFBgAAAAABAAEARwAAAGQAAAAAAA=='

test('File Manager extracts a verified ZIP through the packaged dedicated Worker', async ({ extension }) => {
  const page = await extension.context.newPage()
  await page.goto(`chrome-extension://${extension.extensionId}/newtab.html`)
  await page.evaluate(async ({ probeDirectory, archiveName, zipFixtureBase64 }) => {
    const bytes = Uint8Array.from(atob(zipFixtureBase64), (char) => char.charCodeAt(0))
    const root = await navigator.storage.getDirectory()
    const directory = await root.getDirectoryHandle(probeDirectory, { create: true })
    const file = await directory.getFileHandle(archiveName, { create: true })
    const writable = await file.createWritable()
    await writable.write(bytes)
    await writable.close()
    Object.defineProperty(globalThis, 'showDirectoryPicker', { configurable: true, value: async () => directory })
  }, { probeDirectory, archiveName, zipFixtureBase64 })

  await page.locator('.app-icon--file-manager').click()
  const app = page.locator('[data-app-id="file-manager"]')
  await app.getByRole('button', { name: '选择本地目录并打开系统目录选择器', exact: true }).click()
  await expect(app.getByLabel('fixture.zip，文件条目')).toBeVisible()
  await page.getByRole('button', { name: '只读模式，点击开启写入模式' }).click()
  await page.getByRole('button', { name: '继续并授权' }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await app.getByRole('button', { name: '解压 fixture.zip' }).click()
  await expect(app.getByRole('status')).toContainText('已解压 1 个文件到“fixture（解压）”。')
  await expect(app.getByRole('button', { name: '打开文件夹 fixture（解压）' })).toBeVisible()
  await expect.poll(() => page.evaluate(async ({ probeDirectory }) => {
    const root = await navigator.storage.getDirectory()
    const directory = await root.getDirectoryHandle(probeDirectory)
    const output = await directory.getDirectoryHandle('fixture（解压）')
    const nested = await output.getDirectoryHandle('nested')
    return await (await nested.getFileHandle('hello.txt')).getFile().then((file) => file.text())
  }, { probeDirectory })).toBe('uNAS ZIP extraction fixture')
  expect(extension.errors).toEqual([])
  expect(extension.remoteRequests).toEqual([])
})
