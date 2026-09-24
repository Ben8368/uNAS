import { test, expect } from './fixtures'
import { readFileSync } from 'node:fs'

const repositoryRevision = JSON.parse(readFileSync(new URL('../../../filters/unas.json', import.meta.url), 'utf8')).revision as number

// Public homepage CSS index-dbcc077a.css inspected 2026-09-22: nth-of-type
// switches top margins at 6/8 and 13, although hidden slots retain DOM indexes.
const fixture = '<!doctype html><style>' +
  '.container{display:grid;grid-template-columns:repeat(5,1fr);gap:20px}.carousel{grid-column:span 2;grid-row:span 2;background:#ccc}' +
  '.feed-card,.bili-feed-card,.floor-single-card,.bili-video-card.skeleton{height:120px;background:#ddd}.cover{height:80px;background:#abc}.container>*:nth-of-type(n+8){margin-top:40px}.container.is-version8>*:nth-of-type(n+13){margin-top:24px}' +
  '@media(max-width:1399px){.container{grid-template-columns:repeat(4,1fr)}.container>*:nth-of-type(n+6){margin-top:40px}.container.is-version8>*:nth-of-type(n+13){margin-top:22px}}' +
  '</style><div class="recommended-container_floor-aside"><div class="container is-version8"><div class="carousel">Carousel</div>' +
  Array.from({ length: 17 }, (_, i) => {
    const kind = i === 6 || i === 12 ? 'floor-single-card' : i === 14 ? 'bili-video-card skeleton' : i > 9 ? 'bili-feed-card' : 'feed-card'
    const label = i === 6 ? 'Live' : i === 12 ? 'Anime' : 'Video'
    return '<div data-card class="' + kind + '" id="card-' + i + '"><div class="bili-video-card"><a href="https://' + (i === 1 || i === 8 ? 'cm.bilibili.com/' : 'www.bilibili.com/video/') + '"><div class="cover">' + label + '</div>Card ' + i + '</a></div></div>'
  }).join('') + '</div></div>'

for (const width of [1100, 1440, 2100]) {
  test('Bilibili filtered rows stay aligned at ' + width, async ({ extension }, testInfo) => {
    const url = 'https://www.bilibili.com/unas-layout-fixture'
    await extension.context.route(url, route => route.fulfill({ contentType: 'text/html', body: fixture }))
    const worker = extension.context.serviceWorkers()[0]!
    const page = await extension.context.newPage()
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(url)
    await expect(page.locator('#card-1')).toBeHidden()
    const assertAligned = async () => {
      const boxes = await page.locator('[data-card]:visible').evaluateAll(cards => cards.map(card => {
        const box = card.getBoundingClientRect()
        return { x: box.x, y: box.y, margin: getComputedStyle(card).marginTop, coverTop: card.querySelector('.cover')!.getBoundingClientRect().top }
      }))
      expect(boxes.length).toBeGreaterThan(10)
      for (let i = 0; i < boxes.length; i++) {
        expect(boxes[i].margin).toBe('0px')
        if (i && boxes[i].x > boxes[i - 1].x) {
          expect(boxes[i].y).toBeCloseTo(boxes[i - 1].y, 1)
          expect(boxes[i].coverTop).toBeCloseTo(boxes[i - 1].coverTop, 1)
        }
      }
    }
    // The previous patch aligned videos but omitted floor/live/anime and skeleton slots.
    const style = page.locator('style[id^="unipass-cosmetic-style-"]')
    const patchedCss = await style.textContent()
    // Keep mutation and measurement in one page task: the runtime may resync
    // cosmetic CSS after DOMContentLoaded and restore it between evaluate calls.
    const negativeControl = await style.evaluate(el => {
      const original = el.textContent!
      const legacy = original.replace('.feed-card,.bili-feed-card,.floor-single-card,.bili-video-card,.load-more-anchor', '.feed-card,.bili-feed-card')
      try {
        el.textContent = legacy
        const boxes = Array.from(document.querySelectorAll<HTMLElement>('[data-card]'))
          .filter(card => getComputedStyle(card).display !== 'none').map(card => card.getBoundingClientRect())
        return { changed: original !== legacy, misaligned: boxes.some((box, i) => i > 0 && box.x > boxes[i - 1].x && Math.abs(box.y - boxes[i - 1].y) > 1) }
      } finally { el.textContent = original }
    })
    expect(negativeControl).toEqual({ changed: true, misaligned: true })
    await testInfo.attach('negative-layout-control', { body: JSON.stringify(negativeControl), contentType: 'application/json' })
    await style.evaluate((el, css) => { el.textContent = css }, patchedCss)
    await assertAligned()
    await page.locator('#card-1 a').evaluate(a => a.setAttribute('href', 'https://www.bilibili.com/video/'))
    await expect(page.locator('#card-1')).toBeVisible()
    await assertAligned()
    await page.locator('.container').evaluate(root => {
      const card = root.querySelector('.floor-single-card')!.cloneNode(true) as HTMLElement
      card.id = 'late-card'
      root.append(card)
    })
    await expect(page.locator('#late-card')).toBeVisible()
    await assertAligned()
    await page.screenshot({ path: testInfo.outputPath('aligned.png'), animations: 'disabled' })
    const refresh = async (paused: boolean, withdraw = false) => worker.evaluate(async ({ url, paused, withdraw, revision }) => {
      await chrome.storage.local.set({ unipass_blocking_paused_sites: paused ? [{ host: 'www.bilibili.com', expiresAt: Date.now() + 600000 }] : [] })
      if (withdraw) await chrome.storage.local.set({ unas_repository_filters: { version: 1, revision: revision + 1, sites: [] } })
      const [tab] = await chrome.tabs.query({ url })
      await chrome.tabs.sendMessage(tab.id!, { type: paused ? 'clearCosmeticEffects' : 'refreshCosmeticEffects' })
    }, { url, paused, withdraw, revision: repositoryRevision })
    await refresh(true)
    await expect(page.locator('#card-8')).toBeVisible()
    await expect(page.locator('#card-7')).toHaveCSS('margin-top', '40px')
    await expect(page.locator('#card-6')).toHaveCSS('margin-top', '40px')
    await page.screenshot({ path: testInfo.outputPath('paused-original.png'), animations: 'disabled' })
    await refresh(false)
    await expect(page.locator('#card-8')).toBeHidden()
    await assertAligned()
    await refresh(false, true)
    await expect(page.locator('#card-8')).toBeVisible()
    await expect(page.locator('#card-7')).toHaveCSS('margin-top', '40px')
    expect(extension.errors).toEqual([])
  })
}
