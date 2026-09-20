import { test, expect, closeApp } from './fixtures'
import { validZip } from './archiveFixtures'

const probe = 'unas-sp04-cancellation-fixtures'

async function installDirectory(page: import('@playwright/test').Page) {
  await page.evaluate(async ({ name, base64 }) => {
    const directory = await (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true })
    const writable = await (await directory.getFileHandle('input.zip', { create: true })).createWritable()
    await writable.write(Uint8Array.from(atob(base64), byte => byte.charCodeAt(0)))
    await writable.close()
    Object.defineProperty(globalThis, 'showDirectoryPicker', { configurable: true, value: async () => directory })
  }, { name: probe, base64: validZip.toString('base64') })
}

async function openWritableFileManager(page: import('@playwright/test').Page) {
  await page.locator('.app-icon--file-manager').click()
  const app = page.locator('[data-app-id="file-manager"]')
  await app.getByRole('button', { name: '选择本地目录并打开系统目录选择器', exact: true }).click()
  await page.getByRole('button', { name: '只读模式，点击开启写入模式' }).click()
  await page.getByRole('button', { name: '继续并授权' }).click()
  return app
}

async function blockWorkerAcknowledgements(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const nativeWorker = globalThis.Worker
    Object.defineProperty(globalThis, '__unasNativeWorker', { configurable: true, value: nativeWorker })
    Object.defineProperty(globalThis, 'Worker', {
      configurable: true,
      value: new Proxy(nativeWorker, {
        construct(Target, args) {
          const worker = Reflect.construct(Target, args) as Worker
          const postMessage = worker.postMessage.bind(worker)
          worker.postMessage = ((message: unknown, transfer?: Transferable[]) => {
            if (typeof message === 'object' && message && (message as { type?: unknown }).type === 'ack') return
            return transfer ? postMessage(message, transfer) : postMessage(message)
          }) as typeof worker.postMessage
          return worker
        },
      }),
    })
  })
}

async function restoreWorker(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const nativeWorker = (globalThis as typeof globalThis & { __unasNativeWorker: typeof Worker }).__unasNativeWorker
    Object.defineProperty(globalThis, 'Worker', { configurable: true, value: nativeWorker })
  })
}

async function directChildNames(page: import('@playwright/test').Page) {
  return await page.evaluate(async name => {
    const directory = await (await navigator.storage.getDirectory()).getDirectoryHandle(name)
    const names: string[] = []
    for await (const key of directory.keys()) names.push(key)
    return names.sort()
  }, probe)
}

async function removeProbe(page: import('@playwright/test').Page) {
  await page.evaluate(async name => {
    // Only the fixed, generated OPFS test directory in Playwright's temporary profile.
    await (await navigator.storage.getDirectory()).removeEntry(name, { recursive: true })
  }, probe)
}

test('ZIP cancellation and Files-window closure stop pre-commit work without output', async ({ extension }) => {
  const page = await extension.context.newPage()
  await page.goto(`chrome-extension://${extension.extensionId}/newtab.html`)
  await installDirectory(page)
  await blockWorkerAcknowledgements(page)
  const app = await openWritableFileManager(page)

  const extract = async () => {
    page.once('dialog', dialog => dialog.accept())
    await app.getByRole('button', { name: '解压 input.zip' }).click()
    await expect(app.getByRole('button', { name: '取消解压' })).toBeVisible()
  }

  try {
    await extract()
    await app.getByRole('button', { name: '取消解压' }).click()
    await expect(app.getByRole('alert')).toContainText('已取消解压；未向目录写入任何文件。')
    expect(await directChildNames(page)).toEqual(['input.zip'])

    await restoreWorker(page)
    page.once('dialog', dialog => dialog.accept())
    await app.getByRole('button', { name: '解压 input.zip' }).click()
    await expect(app.getByRole('status')).toContainText('已解压 1 个文件')

    await blockWorkerAcknowledgements(page)
    await extract()
    await closeApp(page, 'file-manager')
    expect(await directChildNames(page)).toEqual(['input.zip', 'input（解压）'])
    expect(extension.errors).toEqual([])
    expect(extension.remoteRequests).toEqual([])
  } finally {
    await removeProbe(page)
  }
})
