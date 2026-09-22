import { convertFilterList } from "./filter-converter";
import { compactDomainRules } from "./rule-compactor";
import { COSMETIC_STORAGE_KEY, COSMETIC_STAGING_STORAGE_KEY, createCosmeticStore, validateCosmeticStore, type CosmeticStore } from "./cosmetic-store";
import { refreshOpenCosmeticEffects } from "./cosmetic-notifier";
import { updateRepositorySubscription } from "./repository-updater";
import {
  FILTER_SUBSCRIPTIONS, FILTER_UPDATE_ALARM, FILTER_UPDATE_STORAGE_KEY,
  FILTER_UPDATE_INTERVAL_MS, FILTER_RULE_ID_BASE, FILTER_RULE_LIMIT, FILTER_GENERATION,
} from "./subscriptions";

interface UpdateState {
  generation?: number;
  checkedAt?: number;
  updatedAt?: number;
  ruleCount?: number;
  error?: string;
}
let pending: Promise<void> | undefined;

export function updateFilterSubscriptions(): Promise<void> {
  // Independent state/transactions: an unavailable repository never prevents
  // EasyList updates, and a failed EasyList download never blocks site hotfixes.
  pending ??= Promise.allSettled([update(), updateRepositorySubscription()]).then((results) => {
    const failure = results.find((result) => result.status === 'rejected');
    if (failure?.status === 'rejected') throw failure.reason;
  }).finally(() => { pending = undefined; });
  return pending;
}

export function isSubscriptionRule(rule: chrome.declarativeNetRequest.Rule): boolean {
  return rule.id >= FILTER_RULE_ID_BASE && rule.id < FILTER_RULE_ID_BASE + FILTER_RULE_LIMIT;
}

async function update(): Promise<void> {
  await chrome.alarms.create(FILTER_UPDATE_ALARM, { periodInMinutes: 60 });
  const stored = await chrome.storage.local.get([FILTER_UPDATE_STORAGE_KEY, COSMETIC_STORAGE_KEY]);
  const state: UpdateState = stored[FILTER_UPDATE_STORAGE_KEY] ?? {};
  const cosmetic = validateCosmeticStore(stored[COSMETIC_STORAGE_KEY]) ? stored[COSMETIC_STORAGE_KEY] as CosmeticStore : undefined;
  const installed = await chrome.declarativeNetRequest.getDynamicRules();
  const existing = installed.filter(isSubscriptionRule);
  const age = Date.now() - (state.updatedAt ?? 0);
  if (existing.length && state.generation === FILTER_GENERATION && state.ruleCount === existing.length
    && cosmetic?.generation === FILTER_GENERATION
    && age >= 0 && age < FILTER_UPDATE_INTERVAL_MS) return;
  let dnrApplied = false;
  let addRules: chrome.declarativeNetRequest.Rule[] = [];
  try {
    // Fetch all sources before touching installed rules. Partial downloads never replace a complete generation.
    const lists = await Promise.all(FILTER_SUBSCRIPTIONS.map(source => fetchFilterList(source.url)));
    for (const list of lists) {
      if (convertFilterList(list).report.block === 0) throw new Error("订阅没有有效拦截规则");
    }
    const rules = compactDomainRules(convertFilterList(lists.join("\n")).rules);
    const nextCosmetic = createCosmeticStore(lists.join("\n"), FILTER_GENERATION);
    if (!rules.length || rules.length + installed.length - existing.length > FILTER_RULE_LIMIT) {
      throw new Error("订阅规则超出浏览器额度");
    }
    addRules = rules.map((rule, index) => ({ ...rule, id: FILTER_RULE_ID_BASE + index }));
    // Stage verified page data before changing DNR. If the second storage write
    // fails after DNR accepts the batch, the old dynamic generation is restored.
    await chrome.storage.local.set({ [COSMETIC_STAGING_STORAGE_KEY]: nextCosmetic });
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: existing.map(rule => rule.id), addRules });
    dnrApplied = true;
    const now = Date.now();
    await chrome.storage.local.set({ [COSMETIC_STORAGE_KEY]: nextCosmetic, [FILTER_UPDATE_STORAGE_KEY]: {
      generation: FILTER_GENERATION, checkedAt: now, updatedAt: now, ruleCount: addRules.length,
    } });
    await removeCosmeticStaging();
    await refreshOpenCosmeticEffects();
  } catch {
    // An update failure must leave the previous DNR and cosmetic generations
    // usable. The normal Chrome API call is atomic; the explicit restore is for
    // the cross-API failure after DNR has already accepted the new batch.
    const current = dnrApplied ? await chrome.declarativeNetRequest.getDynamicRules().catch(() => []) : [];
    const newIds = current.filter((rule) => addRulesForGeneration(rule) && addRules.some((candidate) => candidate.id === rule.id)).map((rule) => rule.id);
    if (newIds.length) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: newIds,
        addRules: existing,
      }).catch(() => {});
    }
    await removeCosmeticStaging();
    await chrome.storage.local.set({ [FILTER_UPDATE_STORAGE_KEY]: {
      ...state, checkedAt: Date.now(), error: existing.length ? "规则订阅更新失败，已保留上一版规则；后台将自动重试" : "首次规则订阅尚未成功，后台将自动重试",
    } });
  }
}

function addRulesForGeneration(rule: chrome.declarativeNetRequest.Rule): boolean {
  return isSubscriptionRule(rule);
}

async function removeCosmeticStaging(): Promise<void> {
  if (typeof chrome.storage.local.remove === "function") await chrome.storage.local.remove(COSMETIC_STAGING_STORAGE_KEY).catch(() => {});
}

/** Remote files are bounded UTF-8 filter data, never scripts or extension code. */
export async function fetchFilterList(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal, credentials: "omit", cache: "no-store", redirect: "error", referrerPolicy: "no-referrer",
    });
    if (!response.ok || !response.body || /text\/html/i.test(response.headers.get("content-type") ?? "")) {
      throw new Error("订阅响应无效");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let bytes = 0, text = "";
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 5 * 1024 * 1024) throw new Error("订阅文件过大");
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } finally { await reader.cancel().catch(() => {}); }
    if (!/^\[Adblock Plus [\d.]+\]/.test(text.trimStart())) throw new Error("订阅格式无效");
    return text;
  } finally { clearTimeout(timeout); }
}
