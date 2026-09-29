import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BLOCKING_PAUSE_STORAGE_KEY } from '../contracts'
import { pauseCurrentSite, reconcileSitePauses, resumeCurrentSite, type PausedSite } from './site-pauses'

vi.mock('./cosmetic-notifier', () => ({ notifyCosmeticForHosts: vi.fn(async () => {}) }))
let sites: PausedSite[]
let rules: chrome.declarativeNetRequest.Rule[]
const sender = { id: 'review-extension' }
const hosts = () => sites.map(site => site.host).sort()
const ruleHosts = () => rules.flatMap(rule => rule.condition.requestDomains ?? []).sort()
beforeEach(() => {
  sites = []
  rules = []
  vi.stubGlobal('chrome', {
    runtime: { id: sender.id },
    tabs: { get: vi.fn(async (id: number) => ({ id, url: `https://${id === 1 ? 'a' : 'b'}.example/` })) },
    storage: { local: {
      get: vi.fn(async () => ({ [BLOCKING_PAUSE_STORAGE_KEY]: structuredClone(sites) })),
      set: vi.fn(async (value: Record<string, PausedSite[]>) => { sites = structuredClone(value[BLOCKING_PAUSE_STORAGE_KEY]) }),
    } },
    declarativeNetRequest: {
      getDynamicRules: vi.fn(async () => structuredClone(rules)),
      updateDynamicRules: vi.fn(async ({ removeRuleIds = [], addRules = [] }: chrome.declarativeNetRequest.UpdateRuleOptions) => {
        rules = [...rules.filter(rule => !removeRuleIds.includes(rule.id)), ...structuredClone(addRules)]
      }),
    },
  })
})
afterEach(() => vi.unstubAllGlobals())

describe('serialized site pause mutations', () => {
  it('retains both sites when two windows pause concurrently', async () => {
    await Promise.all([pauseCurrentSite(sender, 1), pauseCurrentSite(sender, 2)])
    expect(hosts()).toEqual(['a.example', 'b.example'])
    expect(ruleHosts()).toEqual(hosts())
  })
  it('does not restore a resumed site when another site is paused concurrently', async () => {
    await pauseCurrentSite(sender, 1)
    await Promise.all([resumeCurrentSite(sender, 1), pauseCurrentSite(sender, 2)])
    expect(hosts()).toEqual(['b.example'])
    expect(ruleHosts()).toEqual(hosts())
  })
  it('serializes expiration cleanup with a new pause', async () => {
    sites = [{ host: 'expired.example', expiresAt: Date.now() - 1 }]
    await Promise.all([reconcileSitePauses(), pauseCurrentSite(sender, 2)])
    expect(hosts()).toEqual(['b.example'])
    expect(ruleHosts()).toEqual(hosts())
  })
  it('rolls back a failed write before the next mutation starts', async () => {
    await pauseCurrentSite(sender, 1)
    vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error('storage failed'))
    const results = await Promise.allSettled([resumeCurrentSite(sender, 1), pauseCurrentSite(sender, 2)])
    expect(results.map(result => result.status)).toEqual(['rejected', 'fulfilled'])
    expect(hosts()).toEqual(['a.example', 'b.example'])
    expect(ruleHosts()).toEqual(hosts())
  })
  it('does not poison the queue after a DNR failure', async () => {
    vi.mocked(chrome.declarativeNetRequest.updateDynamicRules).mockRejectedValueOnce(new Error('DNR failed'))
    const results = await Promise.allSettled([pauseCurrentSite(sender, 1), pauseCurrentSite(sender, 2)])
    expect(results.map(result => result.status)).toEqual(['rejected', 'fulfilled'])
    expect(hosts()).toEqual(['b.example'])
    expect(ruleHosts()).toEqual(hosts())
  })
})
