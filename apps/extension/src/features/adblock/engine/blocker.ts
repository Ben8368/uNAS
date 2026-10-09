import {
  BLOCKING_RECONCILE_ALARM, BLOCKING_DYNAMIC_RULE_ID_BASE,
  BLOCKING_DYNAMIC_RULE_ID_LIMIT, LEGACY_BLOCKING_STORAGE_KEYS, BASELINE_RULE_COUNT, type BlockingStatus,
} from "../contracts";
import { isSubscriptionRule } from "./filter-updater";
import { FILTER_UPDATE_STORAGE_KEY } from "./subscriptions";
import { reconcileSitePauses } from "./site-pauses";
import { REPOSITORY_UPDATE_STORAGE_KEY } from "./repository-updater";

let reconciliation: Promise<void> | undefined;

/** Dynamic DNR rules persist across worker sleep, browser restarts and extension updates. */
export function initializeBlocking(): Promise<void> {
  reconciliation ??= reconcileBlockingState().finally(() => { reconciliation = undefined; });
  return reconciliation;
}

export async function getBlockingStatus(): Promise<BlockingStatus> {
  await initializeBlocking();
  const rules = (await chrome.declarativeNetRequest.getDynamicRules()).filter(isSubscriptionRule);
  const stored = await chrome.storage.local.get([FILTER_UPDATE_STORAGE_KEY, REPOSITORY_UPDATE_STORAGE_KEY]);
  const state = stored[FILTER_UPDATE_STORAGE_KEY] as { updatedAt?: number; error?: string } | undefined;
  const repositoryState = stored[REPOSITORY_UPDATE_STORAGE_KEY] as { error?: string } | undefined;
  const error = [state?.error, repositoryState?.error].filter(Boolean).join("；") || undefined;
  const status = rules.length ? (error ? "stale" : "ready") : (error ? "error" : "baseline-only");
  return { enabled: true, state: status, ready: status === "ready", ruleCount: rules.length,
    baselineRuleCount: BASELINE_RULE_COUNT, updatedAt: state?.updatedAt, error };
}

async function reconcileBlockingState(): Promise<void> {
  await chrome.alarms.create(BLOCKING_RECONCILE_ALARM, { periodInMinutes: 1 });
  const dnr = chrome.declarativeNetRequest;
  const obsolete = (await dnr.getDynamicRules()).filter((rule) =>
    rule.id >= BLOCKING_DYNAMIC_RULE_ID_BASE && rule.id < BLOCKING_DYNAMIC_RULE_ID_LIMIT
      && rule.action.type === "allowAllRequests");
  if (obsolete.length) await dnr.updateDynamicRules({ removeRuleIds: obsolete.map((rule) => rule.id) });
  await chrome.storage.local.remove(LEGACY_BLOCKING_STORAGE_KEYS);
  await reconcileSitePauses();
}
