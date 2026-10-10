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
  { env: 'UNAS_MUSIC_KGM_FIXTURE', path: configuredFixturePath('UNAS_MUSIC_KGM_FIXTURE'), format: 'KGM' },
  { env: 'UNAS_MUSIC_NCM_FIXTURE', path: configuredFixturePath('UNAS_MUSIC_NCM_FIXTURE'), format: 'NCM' },
  { env: 'UNAS_MUSIC_QMC_FIXTURE', path: configuredFixturePath('UNAS_MUSIC_QMC_FIXTURE'), format: 'QMC' },
]

type Sample = (typeof samples)[number]

function hasFixture(sample: Sample) {
  return Boolean(sample.path && existsSync(sample.path))
}

function requiredFixturePath(sample: Sample) {
  if (!sample.path) throw new Error(`Fixture path unexpectedly missing for ${sample.env}.`)
  return sample.path
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

for (const sample of samples) {
  test.describe(`${sample.format} private encrypted sample`, () => {
    test.skip(!hasFixture(sample), `未配置或不存在私有音乐夹具；请配置 ${sample.env}。该格式用例独立跳过，不影响其他格式。`)

  test(`${sample.format} local music decrypt downloads, hashes, retries, and cleans staged output`, async ({ extension }) => {
    const fixturePath = requiredFixturePath(sample)
    const page = await workspace(extension, 'music')
    const app = page.locator('[data-app-id="music"]')
    await expect(app.getByText('Worker READY')).toBeVisible()

    await app.locator('input[type="file"]').setInputFiles(fixturePath)
    await app.getByRole('button', { name: '开始解密', exact: true }).click()
    await expect(app.locator('.music-app__result strong')).toHaveText(/^(FLAC|MP3|OGG|WAV) 音频签名已识别$/, { timeout: 20_000 })
    const outputFormat = (await app.locator('.music-app__result strong').innerText()).split(' ')[0].toLowerCase()
    const expectedHash = await app.locator('[data-output-sha256]').getAttribute('data-output-sha256')
    expect(expectedHash).toMatch(/^[0-9a-f]{64}$/)

    const downloadPromise = page.waitForEvent('download')
    await app.getByRole('button', { name: '下载解密结果', exact: true }).click()
    const download = await downloadPromise
    const downloadedPath = await download.path()
    expect(downloadedPath).not.toBeNull()
    expect(download.suggestedFilename().toLowerCase()).toMatch(/\.(flac|mp3|ogg|wav)$/)
    expect(download.suggestedFilename().toLowerCase()).toMatch(new RegExp(`\\.${outputFormat}$`))
    expect(sha256(downloadedPath!)).toBe(expectedHash)
    await expect(app).toContainText('无法确认下载是否完成')
    await page.waitForTimeout(1_200)
    expect(await stagedMusicEntries(page)).toHaveLength(1)

    const retryPromise = page.waitForEvent('download')
    await app.getByRole('button', { name: '下载解密结果', exact: true }).click()
    const retry = await retryPromise
    const retryPath = await retry.path()
    expect(retryPath).not.toBeNull()
    expect(sha256(retryPath!)).toBe(expectedHash)
    await expect(app).toContainText('可重试下载')
    expect(await stagedMusicEntries(page)).toHaveLength(1)

    await app.getByRole('button', { name: '清理暂存', exact: true }).click()
    await expect(app.getByRole('button', { name: '下载解密结果', exact: true })).toHaveCount(0)
    expect(await stagedMusicEntries(page)).toEqual([])
    expect(extension.remoteRequests).toEqual([])
    expect(extension.errors).toEqual([])
  })

  test(`${sample.format} local music download failure keeps a retryable staged result`, async ({ extension }) => {
    const fixturePath = requiredFixturePath(sample)
    const page = await workspace(extension, 'music')
    const app = page.locator('[data-app-id="music"]')
    await app.locator('input[type="file"]').setInputFiles(fixturePath)
    await app.getByRole('button', { name: '开始解密', exact: true }).click()
    await expect(app.locator('.music-app__result strong')).toHaveText(/^(FLAC|MP3|OGG|WAV) 音频签名已识别$/, { timeout: 20_000 })
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

  test(`${sample.format} local music cancellation reports cancellation and cleans staged output`, async ({ extension }) => {
    const fixturePath = requiredFixturePath(sample)
    const page = await workspace(extension, 'music')
    const app = page.locator('[data-app-id="music"]')
    await app.locator('input[type="file"]').setInputFiles(fixturePath)
    await app.getByRole('button', { name: '开始解密', exact: true }).click()
    await expect(app.getByRole('button', { name: '取消并清理', exact: true })).toBeEnabled()
    await app.getByRole('button', { name: '取消并清理', exact: true }).click()
    await expect(app).toContainText('已取消；Worker 和 OPFS 暂存已清理。', { timeout: 5_000 })
    await expect(app.getByRole('button', { name: '下载解密结果', exact: true })).toHaveCount(0)
    expect(await stagedMusicEntries(page)).toEqual([])
    expect(extension.remoteRequests).toEqual([])
    expect(extension.errors).toEqual([])
  })
  })
}
