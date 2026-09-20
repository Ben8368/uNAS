import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { type Page } from '@playwright/test'
import { test, expect, workspace } from './fixtures'

function configuredFixturePath(name: string) {
  const configured = process.env[name]?.trim()
  return configured ? path.resolve(configured) : undefined
}

const samples = [
  { env: 'UNAS_MUSIC_KGM_FIXTURE', path: configuredFixturePath('UNAS_MUSIC_KGM_FIXTURE'), format: 'FLAC', extension: '.flac' },
  { env: 'UNAS_MUSIC_NCM_FIXTURE', path: configuredFixturePath('UNAS_MUSIC_NCM_FIXTURE'), format: 'MP3', extension: '.mp3' },
  { env: 'UNAS_MUSIC_QMC_FIXTURE', path: configuredFixturePath('UNAS_MUSIC_QMC_FIXTURE'), format: 'OGG', extension: '.ogg' },
]

function hasFixture(sample: (typeof samples)[number]) {
  return Boolean(sample.path && existsSync(sample.path))
}

function missingFixtureMessage(selected: Array<(typeof samples)[number]>) {
  const missing = selected.filter((sample) => !hasFixture(sample)).map((sample) => sample.env)
  return `未配置或不存在私有音乐夹具；请配置 ${missing.join('、')}。该用例已跳过，不计入通过数。`
}

function sha256(filePath: string) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

async function stagedMusicEntries(page: Page) {
  return await page.evaluate(async () => {
    const names: string[] = []
    const root = await navigator.storage.getDirectory()
    for await (const [name] of root.entries()) if (name.startsWith('unas-music-')) names.push(name)
    return names.sort()
  })
}

test('local music download keeps staged output, matches SHA-256, and supports retry', async ({ extension }) => {
  test.skip(!samples.every(hasFixture), missingFixtureMessage(samples))
  const page = await workspace(extension, 'music')
  const app = page.locator('[data-app-id="music"]')
  await expect(app.getByText('Worker READY')).toBeVisible()

  for (const [index, sample] of samples.entries()) {
    if (!sample.path) throw new Error(`Fixture path unexpectedly missing for ${sample.env}.`)
    await app.locator('input[type="file"]').setInputFiles(sample.path)
    await app.getByRole('button', { name: '开始解密', exact: true }).click()
    await expect(app).toContainText(`${sample.format} 音频签名已识别`, { timeout: 20_000 })
    const expectedHash = await app.locator('[data-output-sha256]').getAttribute('data-output-sha256')
    expect(expectedHash).toMatch(/^[0-9a-f]{64}$/)

    const downloadPromise = page.waitForEvent('download')
    await app.getByRole('button', { name: '下载解密结果', exact: true }).click()
    const download = await downloadPromise
    const downloadedPath = await download.path()
    expect(downloadedPath).not.toBeNull()
    expect(download.suggestedFilename().toLowerCase()).toContain(sample.extension)
    expect(sha256(downloadedPath!)).toBe(expectedHash)
    await expect(app).toContainText('无法确认下载是否完成')
    await page.waitForTimeout(1_200)
    expect(await stagedMusicEntries(page)).toHaveLength(1)

    if (index === 0) {
      const retryPromise = page.waitForEvent('download')
      await app.getByRole('button', { name: '下载解密结果', exact: true }).click()
      const retry = await retryPromise
      const retryPath = await retry.path()
      expect(retryPath).not.toBeNull()
      expect(sha256(retryPath!)).toBe(expectedHash)
      await expect(app).toContainText('可重试下载')
      expect(await stagedMusicEntries(page)).toHaveLength(1)
    }

    await app.getByRole('button', { name: '清理暂存', exact: true }).click()
    await expect(app.getByRole('button', { name: '下载解密结果', exact: true })).toHaveCount(0)
    expect(await stagedMusicEntries(page)).toEqual([])
  }
  expect(extension.remoteRequests).toEqual([])
  expect(extension.errors).toEqual([])
})

test('local music download failure keeps a retryable staged result', async ({ extension }) => {
  const sample = samples[0]
  test.skip(!hasFixture(sample), missingFixtureMessage([sample]))
  if (!sample.path) throw new Error(`Fixture path unexpectedly missing for ${sample.env}.`)
  const page = await workspace(extension, 'music')
  const app = page.locator('[data-app-id="music"]')
  await app.locator('input[type="file"]').setInputFiles(sample.path)
  await app.getByRole('button', { name: '开始解密', exact: true }).click()
  await expect(app).toContainText('FLAC 音频签名已识别', { timeout: 20_000 })
  await page.evaluate(() => {
    const originalClick = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function click() {
      if (this.download) throw new Error('E2E forced browser download submission failure.')
      originalClick.call(this)
    }
  })
  await app.getByRole('button', { name: '下载解密结果', exact: true }).click()
  await expect(app).toContainText('下载未能提交')
  await expect(app.getByRole('button', { name: '下载解密结果', exact: true })).toHaveCount(1)
  expect(await stagedMusicEntries(page)).toHaveLength(1)
  await app.getByRole('button', { name: '清理暂存', exact: true }).click()
  expect(await stagedMusicEntries(page)).toEqual([])
  expect(extension.remoteRequests).toEqual([])
  expect(extension.errors).toEqual([])
})

test('local music cancellation reports cancellation and cleans staged output', async ({ extension }) => {
  const sample = samples[0]
  test.skip(!hasFixture(sample), missingFixtureMessage([sample]))
  if (!sample.path) throw new Error(`Fixture path unexpectedly missing for ${sample.env}.`)
  const page = await workspace(extension, 'music')
  const app = page.locator('[data-app-id="music"]')
  await app.locator('input[type="file"]').setInputFiles(sample.path)
  await app.getByRole('button', { name: '开始解密', exact: true }).click()
  await app.getByRole('button', { name: '取消并清理', exact: true }).click()
  await expect(app).toContainText('取消', { timeout: 5_000 })
  await expect(app.getByRole('button', { name: '下载解密结果', exact: true })).toHaveCount(0)
  expect(await stagedMusicEntries(page)).toEqual([])
  expect(extension.remoteRequests).toEqual([])
  expect(extension.errors).toEqual([])
})
