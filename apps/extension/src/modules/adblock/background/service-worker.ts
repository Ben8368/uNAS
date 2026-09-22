import { getBlockingStatus, initializeBlocking } from '../engine/blocker'
import { currentSiteState, isSitePaused, pauseCurrentSite, resumeCurrentSite } from '../engine/site-pauses'
import { COSMETIC_STORAGE_KEY, createCosmeticStore, pageRulesForHost, validateCosmeticStore } from '../engine/cosmetic-store'
import { updateFilterSubscriptions } from '../engine/filter-updater'
import { updateRepositorySubscription } from '../engine/repository-updater'
import { REPOSITORY_FILTER_STORAGE_KEY } from '../engine/repository-rules'
import { FILTER_GENERATION, FILTER_UPDATE_ALARM } from '../engine/subscriptions'
import { BLOCKING_RECONCILE_ALARM } from '../contracts'
import { isExtensionPageSender, isWebPageSender, type SenderLike } from '../../../shared/sender-guard'
import type { AdBlockRequest } from '../../../shared/adblock-messages'

const AD_BLOCK_MESSAGE_TYPES = new Set([
  'getBlockingStatus',
  'refreshBlockingSubscriptions',
  'getBlockingSiteState',
  'pauseBlockingForSite',
  'resumeBlockingForSite',
  'getCosmeticRules',
])

type AdBlockResponse = { ok: true; data?: unknown } | { ok: false; error: string }

function messageType(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const type = (value as { type?: unknown }).type
  return typeof type === 'string' ? type : undefined
}

export function isAdBlockMessage(value: unknown): value is AdBlockRequest {
  const type = messageType(value)
  return type != null && AD_BLOCK_MESSAGE_TYPES.has(type)
}

export function installAdBlockBackground(): void {
  refreshSubscriptions()
  void initializeBlocking().catch((error: unknown) => console.warn('广告拦截状态恢复失败', error))

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === BLOCKING_RECONCILE_ALARM) void initializeBlocking().catch((error: unknown) => console.warn('广告拦截状态恢复失败', error))
    if (alarm.name === FILTER_UPDATE_ALARM) refreshSubscriptions()
  })
  chrome.runtime.onStartup.addListener(() => {
    refreshSubscriptions()
    void initializeBlocking().catch((error: unknown) => console.warn('广告拦截状态恢复失败', error))
  })
  chrome.runtime.onInstalled.addListener(() => {
    refreshSubscriptions()
    void initializeBlocking().catch((error: unknown) => console.warn('广告拦截状态恢复失败', error))
  })
}

export async function handleAdBlockMessage(message: unknown, sender: chrome.runtime.MessageSender): Promise<AdBlockResponse> {
  if (!isAdBlockMessage(message)) return { ok: false, error: '广告拦截消息格式无效' }
  try {
    const value = message as AdBlockRequest
    switch (value.type) {
      case 'getBlockingStatus':
        return { ok: true, data: await getBlockingStatus() }
      case 'refreshBlockingSubscriptions':
        if (!isExtensionPageSender(sender, chrome.runtime.id, ['/newtab.html', '/workspace.html'])) throw new Error('规则更新请求来源无效')
        await updateRepositorySubscription({ force: true })
        return { ok: true, data: await getBlockingStatus() }
      case 'getBlockingSiteState':
        return { ok: true, data: await currentSiteState(sender) }
      case 'pauseBlockingForSite':
        return { ok: true, data: await pauseCurrentSite(sender, typeof value.tabId === 'number' ? value.tabId : undefined) }
      case 'resumeBlockingForSite':
        return { ok: true, data: await resumeCurrentSite(sender, typeof value.tabId === 'number' ? value.tabId : undefined) }
      case 'getCosmeticRules':
        return { ok: true, data: await cosmeticRules(sender) }
      default:
        return { ok: false, error: '不支持的广告拦截请求' }
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '广告拦截请求失败' }
  }
}

function refreshSubscriptions(): void {
  void updateFilterSubscriptions().catch(() => console.warn('规则订阅状态无法保存，将在下次启动或定时检查时重试'))
}

async function cosmeticRules(sender: SenderLike) {
  if (!isWebPageSender(sender, chrome.runtime.id, true)) return { generation: 0, selectors: [], scriptlets: [] }
  const url = sender.url
  if (!url) return { generation: 0, selectors: [], scriptlets: [] }
  const parsed = new URL(url)
  if (!/^https?:$/.test(parsed.protocol)) return { generation: 0, selectors: [], scriptlets: [] }
  const stored = await chrome.storage.local.get([COSMETIC_STORAGE_KEY, REPOSITORY_FILTER_STORAGE_KEY])
  const store = validateCosmeticStore(stored[COSMETIC_STORAGE_KEY])
    ? stored[COSMETIC_STORAGE_KEY]
    : createCosmeticStore('', FILTER_GENERATION)
  if (await isSitePaused(parsed.hostname.toLowerCase())) return { generation: store.generation, selectors: [], scriptlets: [] }
  return pageRulesForHost(store, parsed.hostname.toLowerCase(), stored[REPOSITORY_FILTER_STORAGE_KEY])
}
