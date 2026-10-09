import { accountCatalog } from "../shared/api";
import { requireStableUserScope } from "../shared/user-scope";
import type { AccountCatalogResult, UniPassAccount } from "../shared/types";
import { withUserScope } from "./user-scope-guard";

const PREFIX = "legacyAccountCatalogV1:";
const TTL_MS = 15 * 60 * 1000;
const pending = new Map<string, Promise<AccountCatalogResult>>();

/** Only complete display metadata survives Worker suspension; credentials never enter this cache. */
export async function legacyAccountCatalog(userScope: string, force = false, pageUrl?: string): Promise<AccountCatalogResult> {
  const scope = requireStableUserScope(userScope);
  const requestKey = JSON.stringify([scope, pageUrl ?? ""]);
  const existing = pending.get(requestKey);
  if (existing) {
    if (!force) return structuredClone(await existing);
    await existing.catch(() => undefined);
    return legacyAccountCatalog(scope, true, pageUrl);
  }
  const request = load(scope, force, pageUrl);
  pending.set(requestKey, request);
  try { return structuredClone(await request); }
  finally { if (pending.get(requestKey) === request) pending.delete(requestKey); }
}

async function load(scope: string, force: boolean, pageUrl?: string): Promise<AccountCatalogResult> {
  const fullKey = PREFIX + scope;
  const digest = pageUrl ? await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pageUrl)) : undefined;
  const pageKey = digest ? `${fullKey}:page:${Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("")}` : fullKey;
  const key = pageKey;
  let fresh = false;
  const result = await withUserScope(scope, async () => {
    if (!force) {
      const rawFull = (await chrome.storage.session.get(fullKey))[fullKey];
      const full = rawFull && typeof rawFull === "object" ? rawFull as { expiresAt?: number; result?: AccountCatalogResult } : undefined;
      if (pageUrl && full?.expiresAt && full.expiresAt > Date.now() && full.expiresAt <= Date.now() + TTL_MS && full.result?.complete === true && Array.isArray(full.result.entries)) return full.result;
      const raw = (await chrome.storage.session.get(key))[key];
      const stored = raw && typeof raw === "object" ? raw as { expiresAt?: number; result?: AccountCatalogResult } : undefined;
      if (stored && typeof stored.expiresAt === "number" && Number.isFinite(stored.expiresAt) && stored.expiresAt > Date.now() && stored.expiresAt <= Date.now() + TTL_MS && stored.result?.complete === true && Array.isArray(stored.result.entries)) {
        return stored.result as AccountCatalogResult;
      }
    }
    fresh = true;
    const catalog = await accountCatalog(pageUrl);
    return {
      ...catalog,
      entries: catalog.entries.map((entry) => ({
        appId: entry.appId, appName: entry.appName, appUrl: entry.appUrl,
        accounts: entry.accounts.map(displayAccount),
      })),
    };
  });
  // Commit only after the post-request identity check, never cache partial results or errors.
  if (fresh && result.complete) {
    await chrome.storage.session.set({ [key]: { expiresAt: Date.now() + TTL_MS, result } }).catch(() => undefined);
  }
  return result;
}

function displayAccount(account: UniPassAccount): UniPassAccount {
  const display: UniPassAccount = {};
  for (const field of ["id", "accountId", "appAccountUserId"] as const) {
    const value = account[field];
    if (typeof value === "string" || (typeof value === "number" && Number.isFinite(value))) display[field] = value;
  }
  for (const field of ["account", "phoneNumber", "email", "remark"] as const) {
    if (typeof account[field] === "string") display[field] = account[field];
  }
  if (typeof account.topPriority === "boolean") display.topPriority = account.topPriority;
  return display;
}
