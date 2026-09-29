import { createCipheriv, createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test, expect, workspace, closeApp, openApp } from './fixtures'

// Self-authored deterministic bytes, not playable media or a third-party song.
// Exercises the NCM container, real Worker, OPFS and export plumbing only.
const plain = Buffer.concat([Buffer.from('fLaC'), Buffer.alloc(1024, 0x31)])
const audioKey = Buffer.from('unas-synthetic-fixture')
const cipher = createCipheriv('aes-128-ecb', Buffer.from('hzHRAmso5kInbaxW'), null)
const encryptedKey = Buffer.concat([cipher.update(Buffer.concat([Buffer.from('neteasecloudmusic'), audioKey])), cipher.final()]).map(byte => byte ^ 0x64)
const box = Uint8Array.from({ length: 256 }, (_, i) => i)
let j = 0
for (let i = 0; i < 256; i++) { j = (j + box[i] + audioKey[i % audioKey.length]) & 255; [box[i], box[j]] = [box[j], box[i]] }
const encryptedAudio = plain.map((byte, i) => { const a = box[(i + 1) & 255]; return byte ^ box[(a + box[(i + 1 + a) & 255]) & 255] })
const header = Buffer.alloc(14); header.write('CTENFDAM'); header.writeUInt32LE(encryptedKey.length, 10)
const ncm = Buffer.concat([header, encryptedKey, Buffer.alloc(17), encryptedAudio])
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')

async function names(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const result: string[] = []
    for await (const name of (await navigator.storage.getDirectory()).keys()) if (name.startsWith('unas-music-')) result.push(name)
    return result
  })
}

test('synthetic NCM uses Worker hash, retries failed cleanup and preserves output bytes', async ({ extension }, testInfo) => {
  await testInfo.attach('synthetic-fixture', { body: JSON.stringify({ inputBytes: ncm.length, inputSha256: digest(ncm), outputBytes: plain.length, outputSha256: digest(plain), validation: 'signature only, self-authored synthetic bytes' }), contentType: 'application/json' })
  const page = await workspace(extension, 'music')
  const app = page.locator('[data-app-id="music"]')
  await app.locator('input[type="file"]').setInputFiles({ name: 'synthetic.ncm', mimeType: 'application/octet-stream', buffer: ncm })
  await app.getByRole('button', { name: '开始解密', exact: true }).click()
  await expect(app.locator('[data-output-sha256]')).toHaveAttribute('data-output-sha256', digest(plain))
  const downloadPromise = page.waitForEvent('download')
  await app.getByRole('button', { name: '下载解密结果', exact: true }).click()
  const download = await downloadPromise
  expect(readFileSync((await download.path())!)).toEqual(plain)
  expect(await names(page)).toHaveLength(1)
  await page.evaluate(() => {
    const original = FileSystemDirectoryHandle.prototype.removeEntry
    let failed = false
    FileSystemDirectoryHandle.prototype.removeEntry = async function (name, options) {
      if (!failed && name.startsWith('unas-music-')) { failed = true; throw new DOMException('Synthetic cleanup failure', 'NoModificationAllowedError') }
      return original.call(this, name, options)
    }
  })
  await app.getByRole('button', { name: '清理暂存', exact: true }).click()
  await expect(app.getByRole('alert')).toContainText('未能清理')
  expect(await names(page)).toHaveLength(1)
  await app.getByRole('button', { name: '重试清理暂存', exact: true }).click()
  await expect.poll(() => names(page)).toEqual([])
  expect(extension.errors).toEqual([])
})

test('music recovery skips a live lease then reclaims it after its page closes', async ({ extension }) => {
  const holder = await extension.context.newPage()
  await holder.goto(`chrome-extension://${extension.extensionId}/newtab.html`)
  const name = 'unas-music-00000000-0000-0000-0000-000000000002.stage'
  await holder.evaluate(async name => {
    await new Promise<void>(resolve => {
      void navigator.locks.request(`unas-music-stage:${name}`, async () => {
        const root = await navigator.storage.getDirectory()
        const writer = await (await root.getFileHandle(name, { create: true })).createWritable()
        await writer.write('self-authored recovery fixture'); await writer.close()
        resolve()
        await new Promise(() => {})
      })
    })
  }, name)
  const page = await workspace(extension, 'music')
  await expect(page.locator('[data-app-id="music"]')).toContainText('Worker READY')
  expect(await names(page)).toEqual([name])
  await holder.close()
  await page.mouse.move(200, 200)
  await page.keyboard.press('Escape')
  await closeApp(page, 'music')
  await openApp(page, 'music')
  await expect.poll(() => names(page)).toEqual([])
  expect(extension.errors).toEqual([])
})

test('synthetic music cancellation during output hash removes staging without publishing a result', async ({ extension }) => {
  const page = await workspace(extension, 'music')
  await page.evaluate(() => {
    const NativeWorker = Worker
    Object.defineProperty(globalThis, 'Worker', { configurable: true, value: new Proxy(NativeWorker, {
      construct(Target, args) {
        const worker = Reflect.construct(Target, args) as Worker
        const post = worker.postMessage.bind(worker)
        worker.postMessage = ((message: { type?: string }) => {
          if (message.type === 'hash') { Object.assign(globalThis, { hashHeld: true }); return }
          post(message)
        }) as typeof worker.postMessage
        return worker
      },
    }) })
  })
  const app = page.locator('[data-app-id="music"]')
  await app.locator('input[type="file"]').setInputFiles({ name: 'synthetic.ncm', mimeType: 'application/octet-stream', buffer: ncm })
  await app.getByRole('button', { name: '开始解密', exact: true }).click()
  await expect.poll(() => page.evaluate(() => Boolean((globalThis as any).hashHeld))).toBe(true)
  expect(await names(page)).toHaveLength(1)
  await app.getByRole('button', { name: '取消并清理', exact: true }).click()
  await expect(app).toContainText('已取消；Worker 和 OPFS 暂存已清理')
  await expect.poll(() => names(page)).toEqual([])
  await expect(app.getByRole('button', { name: '下载解密结果', exact: true })).toHaveCount(0)
  expect(extension.errors).toEqual([])
})

test('an undeletable old stage warns without blocking a new music task', async ({ extension }) => {
  const page = await extension.context.newPage()
  await page.goto(`chrome-extension://${extension.extensionId}/workspace.html`)
  await page.locator('.rp-edge-trigger').waitFor()
  const name = 'unas-music-00000000-0000-0000-0000-000000000003.stage'
  await page.evaluate(async name => {
    const root = await navigator.storage.getDirectory()
    const stream = await (await root.getFileHandle(name, { create: true })).createWritable()
    await stream.write('synthetic orphan'); await stream.close()
    const original = FileSystemDirectoryHandle.prototype.removeEntry
    FileSystemDirectoryHandle.prototype.removeEntry = async function (target, options) {
      if (target === name) throw new DOMException('Synthetic persistent failure', 'NoModificationAllowedError')
      return original.call(this, target, options)
    }
  }, name)
  const app = await openApp(page, 'music')
  await expect(app).toContainText('历史音乐暂存未能清理')
  await app.locator('input[type="file"]').setInputFiles({ name: 'synthetic.ncm', mimeType: 'application/octet-stream', buffer: ncm })
  await app.getByRole('button', { name: '开始解密', exact: true }).click()
  await expect(app.locator('[data-output-sha256]')).toHaveAttribute('data-output-sha256', digest(plain))
  await expect(app).toContainText('新任务仍可继续')
  expect(await names(page)).toHaveLength(2)
  await app.getByRole('button', { name: '清理暂存', exact: true }).click()
  await expect.poll(() => names(page)).toEqual([name])
  expect(extension.errors).toEqual([])
})
