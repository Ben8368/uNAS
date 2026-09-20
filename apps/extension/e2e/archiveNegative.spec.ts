import { test, expect } from './fixtures'
import { fixtureManifest, unsafeZips, validZip } from './archiveFixtures'

test('unsafe ZIPs fail before commit and the packaged Worker recovers for valid input', async ({ extension }, testInfo) => {
  test.setTimeout(120_000)
  await testInfo.attach('fixture-manifest', { body: JSON.stringify(fixtureManifest(), null, 2), contentType: 'application/json' })
  const page = await extension.context.newPage()
  await page.goto(`chrome-extension://${extension.extensionId}/newtab.html`)
  const probe = 'unas-sp04-negative-fixtures'
  await page.evaluate(async (name) => {
    const directory = await (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true })
    Object.defineProperty(globalThis, 'showDirectoryPicker', { configurable: true, value: async () => directory })
  }, probe)
  await page.locator('.app-icon--file-manager').click()
  const app = page.locator('[data-app-id="file-manager"]')
  await app.getByRole('button', { name: '选择本地目录并打开系统目录选择器', exact: true }).click()
  await page.getByRole('button', { name: '只读模式，点击开启写入模式' }).click()
  await page.getByRole('button', { name: '继续并授权' }).click()

  const writeInput = async (bytes: Buffer) => {
    await page.evaluate(async ({ name, base64 }) => {
      const directory = await (await navigator.storage.getDirectory()).getDirectoryHandle(name)
      const writable = await (await directory.getFileHandle('input.zip', { create: true })).createWritable()
      await writable.write(Uint8Array.from(atob(base64), c => c.charCodeAt(0)))
      await writable.close()
    }, { name: probe, base64: bytes.toString('base64') })
    await app.getByRole('button', { name: '刷新', exact: true }).click()
    await expect(app.getByRole('button', { name: '解压 input.zip' })).toBeEnabled()
  }
  const extract = async () => {
    page.once('dialog', dialog => dialog.accept())
    await app.getByRole('button', { name: '解压 input.zip' }).click()
  }
  try {
    for (const fixture of unsafeZips) {
      await test.step(fixture.id, async () => {
        await writeInput(fixture.data)
        await extract()
        await expect(app.getByRole('alert')).toBeVisible()
        await expect(app.getByRole('button', { name: '解压 input.zip' })).toBeEnabled()
        const names = await page.evaluate(async name => {
          const directory = await (await navigator.storage.getDirectory()).getDirectoryHandle(name)
          const names: string[] = []
          for await (const key of directory.keys()) names.push(key)
          return names.sort()
        }, probe)
        expect(names, `${fixture.id}: no output may exist`).toEqual(['input.zip'])
        await expect(app).not.toContainText('已解压 1 个文件')
      })
    }
    await writeInput(validZip)
    await extract()
    await expect(app.getByRole('status')).toContainText('已解压 1 个文件')
    const content = await page.evaluate(async name => {
      const directory = await (await navigator.storage.getDirectory()).getDirectoryHandle(name)
      const output = await directory.getDirectoryHandle('input（解压）')
      const nested = await output.getDirectoryHandle('nested')
      return (await (await nested.getFileHandle('hello.txt')).getFile()).text()
    }, probe)
    expect(content).toBe('uNAS synthetic ZIP fixture\n')
    expect(extension.errors).toEqual([])
    expect(extension.remoteRequests).toEqual([])
  } finally {
    await page.evaluate(async name => {
      // Only the fixed, newly created OPFS fixture directory in this temporary profile.
      await (await navigator.storage.getDirectory()).removeEntry(name, { recursive: true })
    }, probe)
  }
})
