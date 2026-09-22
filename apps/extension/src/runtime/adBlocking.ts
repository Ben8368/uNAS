import type { BlockingStatus } from 'unas-src/modules/adblock/contracts'
import { hasExtensionMessageRuntime, sendExtensionMessage } from './extensionPlatform'

export type { BlockingStatus }

function isBlockingStatus(value: unknown): value is BlockingStatus {
  if (!value || typeof value !== 'object') return false
  const status = value as Record<string, unknown>
  return status.enabled === true && typeof status.ready === 'boolean'
    && ['baseline-only', 'ready', 'stale', 'error'].includes(status.state as string)
    && Number.isSafeInteger(status.ruleCount) && (status.ruleCount as number) >= 0
    && Number.isSafeInteger(status.baselineRuleCount) && (status.baselineRuleCount as number) >= 0
    && (status.updatedAt === undefined || typeof status.updatedAt === 'number' && Number.isFinite(status.updatedAt) && !Number.isNaN(new Date(status.updatedAt).getTime()))
    && (status.error === undefined || typeof status.error === 'string')
}

/** Uses the existing trusted-page message route; ordinary Web preview has no real status. */
export async function readAdBlockingStatus(): Promise<BlockingStatus | null> {
  return sendForStatus({ type: 'getBlockingStatus' }, '读取拦截状态')
}

/** Explicitly retries the repository supplement from an installed uNAS page. */
export async function refreshAdBlockingStatus(): Promise<BlockingStatus | null> {
  return sendForStatus({ type: 'refreshBlockingSubscriptions' }, '更新拦截规则')
}

async function sendForStatus(message: { type: 'getBlockingStatus' } | { type: 'refreshBlockingSubscriptions' }, action: string): Promise<BlockingStatus | null> {
  if (!hasExtensionMessageRuntime()) return null
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const response = await Promise.race([
      sendExtensionMessage(message),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${action}超时，请重试。`)), 25_000)
      }),
    ])
    const envelope = response as { ok?: unknown; data?: unknown; error?: unknown } | undefined
    if (envelope?.ok !== true) throw new Error(typeof envelope?.error === 'string' ? envelope.error : `${action}失败，请重试。`)
    if (!isBlockingStatus(envelope.data)) throw new Error('无法读取有效的拦截状态，请重试。')
    return envelope.data
  } finally {
    clearTimeout(timer)
  }
}
