import { refreshOpenCosmeticEffects } from './cosmetic-notifier';
import {
  REPOSITORY_FILTER_URL, REPOSITORY_FILTER_STORAGE_KEY, REPOSITORY_FILTER_MAX_BYTES,
  effectiveRepositoryRules, validateRepositoryRules,
} from './repository-rules';
import { FILTER_UPDATE_INTERVAL_MS } from './subscriptions';

export const REPOSITORY_UPDATE_STORAGE_KEY = 'unas_repository_filter_update';
let pending: Promise<void> | undefined;

export function updateRepositorySubscription(options: { force?: boolean } = {}): Promise<void> {
  pending ??= update(options.force === true).finally(() => { pending = undefined; });
  return pending;
}

async function update(force: boolean): Promise<void> {
  const stored = await chrome.storage.local.get([REPOSITORY_FILTER_STORAGE_KEY, REPOSITORY_UPDATE_STORAGE_KEY]);
  const current = effectiveRepositoryRules(stored[REPOSITORY_FILTER_STORAGE_KEY]);
  const state = stored[REPOSITORY_UPDATE_STORAGE_KEY] as { checkedAt?: number; updatedAt?: number } | undefined;
  const age = Date.now() - (state?.checkedAt ?? 0);
  if (!force && age >= 0 && age < FILTER_UPDATE_INTERVAL_MS) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(REPOSITORY_FILTER_URL, {
      signal: controller.signal, credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer',
    });
    if (!response.ok || !response.body || /text\/html/i.test(response.headers.get('content-type') ?? '')) throw new Error('Invalid response');
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let bytes = 0, text = '';
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > REPOSITORY_FILTER_MAX_BYTES) throw new Error('Subscription too large');
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } finally { await reader.cancel().catch(() => {}); }
    const next: unknown = JSON.parse(text);
    if (!validateRepositoryRules(next) || next.revision < current.revision
      || (next.revision === current.revision && JSON.stringify(next) !== JSON.stringify(current))) throw new Error('Invalid revision or schema');
    await chrome.storage.local.set({
      [REPOSITORY_FILTER_STORAGE_KEY]: next,
      [REPOSITORY_UPDATE_STORAGE_KEY]: { checkedAt: Date.now(), updatedAt: Date.now(), revision: next.revision },
    });
    await refreshOpenCosmeticEffects();
  } catch {
    // Do not touch the cached rules or third-party subscription state on failure.
    await chrome.storage.local.set({ [REPOSITORY_UPDATE_STORAGE_KEY]: {
      checkedAt: Date.now(), updatedAt: state?.updatedAt, revision: current.revision,
      error: '仓库补充规则更新失败，继续使用缓存或随包规则',
    } });
  } finally { clearTimeout(timeout); }
}
