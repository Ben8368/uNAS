import { test, expect } from './fixtures'

const directoryName = 'unas-local-media-probe'
const trackName = 'generated-test.wav'

function makeWave(seconds = 5, sampleRate = 8_000) {
  const samples = seconds * sampleRate
  const bytes = new Uint8Array(44 + samples * 2)
  const view = new DataView(bytes.buffer)
  const ascii = (offset: number, text: string) => { for (let index = 0; index < text.length; index += 1) bytes[offset + index] = text.charCodeAt(index) }
  ascii(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); ascii(8, 'WAVE')
  ascii(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  ascii(36, 'data'); view.setUint32(40, samples * 2, true)
  for (let index = 0; index < samples; index += 1) view.setInt16(44 + index * 2, Math.round(Math.sin(index * 2 * Math.PI * 440 / sampleRate) * 4000), true)
  return bytes
}

test('Files plays a generated local WAV, seeks, and revokes its media URL on close', async ({ extension }) => {
  const page = await extension.context.newPage()
  await page.addInitScript(() => {
    const created: string[] = []
    const revoked: string[] = []
    const originalCreate = URL.createObjectURL.bind(URL)
    const originalRevoke = URL.revokeObjectURL.bind(URL)
    URL.createObjectURL = (object: Blob) => { const url = originalCreate(object); created.push(url); return url }
    URL.revokeObjectURL = (url: string) => { revoked.push(url); originalRevoke(url) }
    Object.assign(globalThis, { unasMediaUrls: { created, revoked } })
  })
  await page.goto('chrome-extension://' + extension.extensionId + '/newtab.html')
  await page.evaluate(async ({ directoryName, trackName, data }) => {
    const root = await navigator.storage.getDirectory()
    const directory = await root.getDirectoryHandle(directoryName, { create: true })
    const handle = await directory.getFileHandle(trackName, { create: true })
    const writable = await handle.createWritable()
    await writable.write(new Uint8Array(data))
    await writable.close()
    Object.defineProperty(globalThis, 'showDirectoryPicker', { configurable: true, value: async () => directory })
  }, { directoryName, trackName, data: Array.from(makeWave()) })

  await page.locator('.app-icon--file-manager').click()
  const app = page.locator('[data-app-id="file-manager"]')
  await page.getByRole('button', { name: '选择本地目录并打开系统目录选择器' }).click()
  const mediaRow = app.locator('.fm-row--local').filter({ hasText: trackName })
  await expect(mediaRow).toBeVisible()
  await mediaRow.getByRole('button', { name: '在本地播放器中打开' }).click()

  const audio = app.locator('audio')
  await expect(audio).toBeVisible()
  await expect.poll(() => audio.evaluate(element => (element as HTMLAudioElement).duration)).toBeGreaterThan(0)
  expect(await app.locator('.local-media__capability').textContent()).toContain('canPlayType')
  await app.getByRole('button', { name: '播放', exact: true }).click()
  await expect(app.getByRole('button', { name: '暂停', exact: true })).toBeVisible()

  const seek = app.getByRole('slider', { name: '播放进度' })
  await seek.evaluate((element: HTMLInputElement) => {
    element.value = '1'
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await expect.poll(() => audio.evaluate(element => (element as HTMLAudioElement).currentTime)).toBeGreaterThan(0.5)

  const mediaUrl = await audio.evaluate(element => (element as HTMLAudioElement).currentSrc)
  await app.getByRole('button', { name: '关闭播放器' }).click()
  await expect(audio).toHaveCount(0)
  await expect.poll(() => page.evaluate(url => (globalThis as typeof globalThis & { unasMediaUrls: { revoked: string[] } }).unasMediaUrls.revoked.includes(url), mediaUrl)).toBe(true)
  expect(extension.errors).toEqual([])
})
