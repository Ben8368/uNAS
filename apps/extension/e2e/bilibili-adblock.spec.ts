import { test, expect } from './fixtures'
import { compileCosmeticFilters } from '../src/unipass/background/blocking/cosmetic-compiler'
import { BLOCKING_PAUSE_STORAGE_KEY } from '../src/unipass/shared/blocking'

const COSMETIC_STORAGE_KEY = 'unipass_cosmetic_store'

// Synthetic DOM reproduces the public container/link structure inspected on
// 2026-09-21, without retaining page tracking IDs, images or user content.
const fixture = `<!doctype html><html><head><title>Bilibili cosmetic fixture</title></head><body>
<main id="player">Video player</main><section id="comments">Comments</section>
<div id="strip" class="ad-report strip-ad left-banner"><a class="ad-report-inner"><div class="strip-ad-inner">Banner ad</div></a></div>
<div id="promoted-video" class="video-card-ad-small"><div class="video-card-ad-small-inner"><div class="ad-report"><a class="ad-report-inner" href="https://cm.bilibili.com/cm/api/fees/pc/sync/v2"><div class="vcd">Promoted video</div></a></div></div></div>
<div id="activity" class="ad-report ad-floor-exp right-bottom-banner"><a class="ad-report-inner" href="https://www.bilibili.com/blackboard/synthetic">Site activity</a></div>
<section id="feed">
<div id="feed-ad" class="bili-feed-card"><div class="bili-video-card is-rcmd"><a href="https://cm.bilibili.com/cm/api/fees/pc/sync/v2">Promoted feed card</a></div></div>
<div id="feed-relative-ad" class="bili-feed-card"><div class="bili-video-card"><a href="//cm.bilibili.com/cm/api/fees/pc/sync/v2">Protocol relative promotion</a></div></div>
<div id="ordinary" class="bili-feed-card"><div class="bili-video-card is-rcmd"><a href="https://www.bilibili.com/video/synthetic">CMOS video</a></div></div>
<div id="lookalike" class="bili-feed-card"><div class="bili-video-card"><a href="https://cm.bilibili.com.example.org/">Ordinary external link</a></div></div>
<div id="query-only" class="bili-feed-card"><div class="bili-video-card"><a href="https://www.bilibili.com/video/synthetic?ref=https://cm.bilibili.com/">Ordinary video with URL in query</a></div></div>
<div id="protected" class="bili-feed-card"><div class="bili-video-card"><a href="https://cm.bilibili.com/">Link alongside a protected form</a><input aria-label="Protected input"></div></div>
</section><aside id="ordinary-vcd" class="vcd">Ordinary recommendation</aside>
</body></html>`
const ads = ['strip', 'promoted-video', 'activity', 'feed-ad', 'feed-relative-ad']
const retained = ['player', 'comments', 'ordinary', 'lookalike', 'query-only', 'protected', 'ordinary-vcd']

test('Bilibili placements hide, update dynamically and restore when site protection is paused', async ({ extension }, testInfo) => {
  const url = 'https://www.bilibili.com/video/unas-synthetic-adblock'
  await extension.context.route(url, (route) => route.fulfill({ contentType: 'text/html', body: fixture }))
  const worker = extension.context.serviceWorkers()[0]
  if (!worker) throw new Error('uNAS Service Worker is not running.')
  // An old subscription store must receive the new built-ins without updating.
  await worker.evaluate(async ({ key, store }) => chrome.storage.local.set({ [key]: store }), {
    key: COSMETIC_STORAGE_KEY, store: { version: 2, generation: 1, ...compileCosmeticFilters('') },
  })
  const page = await extension.context.newPage()
  await page.goto(url)
  await expect(page.locator('style[id^="unipass-cosmetic-style-"]')).toHaveCount(1)
  expect(await page.evaluate(() => CSS.supports('selector(:has(a))'))).toBe(true)
  for (const id of ads) await expect(page.locator(`#${id}`)).toBeHidden()
  for (const id of retained) await expect(page.locator(`#${id}`)).toBeVisible()
  // Rules hide the outer grid slot and leave the DOM reversible.
  for (const id of ads) await expect(page.locator(`#${id}`)).toHaveCount(1)
  await page.evaluate(() => {
    const card = document.getElementById('feed-ad')!.cloneNode(true) as HTMLElement
    card.id = 'late-ad'
    document.getElementById('feed')!.append(card)
  })
  await expect(page.locator('#late-ad')).toBeHidden()
  await page.locator('#late-ad a').evaluate((a) => a.setAttribute('href', 'https://www.bilibili.com/video/synthetic'))
  await expect(page.locator('#late-ad')).toBeVisible()
  await page.locator('#late-ad a').evaluate((a) => a.setAttribute('href', '//cm.bilibili.com/cm/api/fees/pc/sync/v2'))
  await expect(page.locator('#late-ad')).toBeHidden()
  await page.screenshot({ path: testInfo.outputPath('bilibili-filtered.png') })

  const setPaused = async (paused: boolean) => worker.evaluate(async ({ key, paused, url }) => {
    await chrome.storage.local.set({ [key]: paused ? [{ host: 'www.bilibili.com', expiresAt: Date.now() + 600_000 }] : [] })
    const [tab] = await chrome.tabs.query({ url })
    if (tab?.id == null) throw new Error('Fixture tab not found.')
    await chrome.tabs.sendMessage(tab.id, { type: paused ? 'clearCosmeticEffects' : 'refreshCosmeticEffects' })
  }, { key: BLOCKING_PAUSE_STORAGE_KEY, paused, url })
  await setPaused(true)
  await expect(page.locator('style[id^="unipass-cosmetic-style-"]')).toHaveCount(0)
  for (const id of [...ads, 'late-ad', ...retained]) await expect(page.locator(`#${id}`)).toBeVisible()
  await setPaused(false)
  for (const id of [...ads, 'late-ad']) await expect(page.locator(`#${id}`)).toBeHidden()
  for (const id of retained) await expect(page.locator(`#${id}`)).toBeVisible()
  // A newer repository revision can withdraw a bad rule without rebuilding.
  await worker.evaluate(async (url) => {
    await chrome.storage.local.set({ unas_repository_filters: { version: 1, revision: 2, sites: [] } })
    const [tab] = await chrome.tabs.query({ url })
    if (tab?.id == null) throw new Error('Fixture tab not found.')
    await chrome.tabs.sendMessage(tab.id, { type: 'refreshCosmeticEffects' })
  }, url)
  for (const id of [...ads, 'late-ad']) await expect(page.locator(`#${id}`)).toBeVisible()
  expect(extension.errors).toEqual([])
})

test('Bilibili rules do not hide identical containers on an unrelated host', async ({ extension }) => {
  const url = 'https://example.org/unas-synthetic-adblock'
  await extension.context.route(url, (route) => route.fulfill({ contentType: 'text/html', body: fixture }))
  const worker = extension.context.serviceWorkers()[0]
  if (!worker) throw new Error('uNAS Service Worker is not running.')
  await worker.evaluate(async ({ key, store }) => chrome.storage.local.set({ [key]: store }), {
    key: COSMETIC_STORAGE_KEY, store: { version: 2, generation: 1, ...compileCosmeticFilters('') },
  })
  const page = await extension.context.newPage()
  await page.goto(url)
  for (const id of [...ads, ...retained]) await expect(page.locator(`#${id}`)).toBeVisible()
  expect(extension.errors).toEqual([])
})
