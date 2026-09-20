import { existsSync } from 'node:fs'
import { test, expect, workspace } from './fixtures'

const samples = [
  { path: 'C:/Users/ben.luo/Downloads/陈奕迅 - K歌之王 (粤语版).kgm.flac', format: 'FLAC' },
  { path: 'C:/Users/ben.luo/Downloads/SunnaLu - Una Mattina.ncm', format: 'MP3' },
  { path: 'C:/Users/ben.luo/Music/VipSongsDownload/5ive _ Queen - We Will Rock You (Radio Edit).mgg', format: 'OGG' },
]

test('local music Worker decrypts KGM, NCM and QMC fixtures and exports staged output', async ({ extension }) => {
  test.skip(!samples.every((sample) => existsSync(sample.path)), '本机未提供维护者本地音乐样本；跳过真实媒体浏览器验证。')
  const page = await workspace(extension, 'music')
  const app = page.locator('[data-app-id="music"]')
  await expect(app.getByText('Worker READY')).toBeVisible()
  for (const sample of samples) {
    await app.locator('input[type="file"]').setInputFiles(sample.path)
    await app.getByRole('button', { name: '开始解密', exact: true }).click()
    await expect(app).toContainText(`${sample.format} 输出`, { timeout: 20_000 })
    const downloadPromise = page.waitForEvent('download')
    await app.getByRole('button', { name: '下载解密结果', exact: true }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename().toLowerCase()).toContain(sample.format === 'MP3' ? '.mp3' : sample.format === 'FLAC' ? '.flac' : '.ogg')
    await expect(app.getByRole('button', { name: '开始解密', exact: true })).toBeEnabled()
    await page.waitForTimeout(1_200)
    expect(await page.evaluate(async () => {
      const names: string[] = []
      const root = await navigator.storage.getDirectory()
      for await (const [name] of root.entries()) if (name.startsWith('unas-music-')) names.push(name)
      return names
    })).toEqual([])
  }
  expect(extension.remoteRequests).toEqual([])
  expect(extension.errors).toEqual([])
})

test('local music cancellation reports cancellation and leaves no result action', async ({ extension }) => {
  const sample = samples[0]
  test.skip(!existsSync(sample.path), '本机未提供维护者本地 KGM 样本；跳过真实取消验证。')
  const page = await workspace(extension, 'music')
  const app = page.locator('[data-app-id="music"]')
  await app.locator('input[type="file"]').setInputFiles(sample.path)
  await app.getByRole('button', { name: '开始解密', exact: true }).click()
  await app.getByRole('button', { name: '取消并清理', exact: true }).click()
  await expect(app).toContainText('取消', { timeout: 5_000 })
  await expect(app.getByRole('button', { name: '下载解密结果', exact: true })).toHaveCount(0)
  expect(await page.evaluate(async () => {
    const names: string[] = []
    const root = await navigator.storage.getDirectory()
    for await (const [name] of root.entries()) if (name.startsWith('unas-music-')) names.push(name)
    return names
  })).toEqual([])
  expect(extension.remoteRequests).toEqual([])
  expect(extension.errors).toEqual([])
})
