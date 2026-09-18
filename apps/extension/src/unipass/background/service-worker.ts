import {
  accountCatalog,
  accountsForApp,
  appUrlForApp,
  currentUser,
  pluginVersionSettings,
  setPluginVersionOverride,
} from "../shared/api";
import {
  credentialAvailabilityForRef,
  credentialForRef,
  createVaultAccount,
  createVaultApp,
  deleteVaultAccount,
  deleteVaultApp,
  listVaultProfiles,
  listVaultConnectionStates,
  listVaultSyncStatuses,
  enableLocalUnlock,
  unlockVaultLocally,
  disableLocalUnlock,
  lockVault,
  removeVault,
  releaseUnusedWebDavPermission,
  requestWebDavPermission,
  saveWebDavVault,
  testWebDavConnection,
  updateVaultAccount,
  updateVaultApp,
  updateVaultCredential,
  vaultAccounts,
  vaultAppUrl,
  vaultCatalog,
  importBrowserPasswords,
  syncAllVaults,
  previewBrowserPasswords,
} from "./vault/vault-service";
import { availableVaultApps } from "./vault/app-availability";
import { popupSessionUserFor } from "../shared/user-scope";
import { isHttpsUrl, isJupiterUrl, normalizeTargetUrl } from "../shared/url";
import { appsWithAvailableCredentials, clearCredentialAvailabilityCache, credentialAvailability } from "./credential-availability";
import {
  getJupiterKeepaliveSettings,
  JUPITER_KEEPALIVE_ALARM,
  restoreJupiterKeepaliveAlarm,
  runKeepJupiterAlive,
  setJupiterKeepalive,
  syncStoredJupiterSessionToTab,
} from "./jupiter-keepalive";
import { clearUniPassLoginForTab, completeUniPassLogin, processUniPassLoginTab, startUniPassLogin } from "./unipass-login";
import { fillFromOverlay, fillFromPopup, openApp, pageContextFor, pageThemeFor, togglePageOverlay } from "./page-overlay";
import { assertRevealSource } from "./credential-access";
import { legacyAccountCatalog } from "./legacy-catalog";
import { assertCurrentUserScope, withUserScope } from "./user-scope-guard";
import { getBlockingStatus, initializeBlocking } from "./blocking/blocker";
import { currentSiteState, isSitePaused, pauseCurrentSite, resumeCurrentSite } from "./blocking/site-pauses";
import { COSMETIC_STORAGE_KEY, createCosmeticStore, pageRulesForHost, validateCosmeticStore } from "./blocking/cosmetic-store";
import type { BackgroundRequest, BackgroundResponse } from "../shared/types";

import { updateFilterSubscriptions } from "./blocking/filter-updater";
import { FILTER_GENERATION, FILTER_UPDATE_ALARM } from "./blocking/subscriptions";
import { BLOCKING_RECONCILE_ALARM } from "../shared/blocking";

function refreshBlockingSubscriptions(): void {
  void updateFilterSubscriptions().catch(() => console.warn("规则订阅状态无法保存，将在下次启动或定时检查时重试"));
}

const VAULT_SYNC_ALARM = "unipass-vault-sync";
let installed = false;

/** Register UniPass lifecycle hooks inside uNAS's single MV3 background entry. */
export function installUniPassBackground(): void {
  if (installed) return;
  installed = true;
  refreshBlockingSubscriptions();
  void initializeBlocking().catch((error: unknown) => console.warn("广告拦截状态恢复失败", error));
  void chrome.alarms.create(VAULT_SYNC_ALARM, { periodInMinutes: 5 });
  void syncAllVaults().catch(() => { /* offline startup is expected; the cache remains authoritative */ });
  void restoreJupiterKeepaliveAlarm().catch((error: unknown) => console.warn("木星保活恢复失败", error));

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === JUPITER_KEEPALIVE_ALARM) void runKeepJupiterAlive();
    if (alarm.name === BLOCKING_RECONCILE_ALARM) void initializeBlocking().catch((error: unknown) => console.warn("广告拦截状态恢复失败", error));
    if (alarm.name === FILTER_UPDATE_ALARM) refreshBlockingSubscriptions();
    if (alarm.name === VAULT_SYNC_ALARM) void syncAllVaults();
  });
  chrome.runtime.onStartup.addListener(() => {
    refreshBlockingSubscriptions();
    void initializeBlocking().catch((error: unknown) => console.warn("广告拦截状态恢复失败", error));
    void syncAllVaults();
  });
  chrome.runtime.onInstalled.addListener(() => {
    refreshBlockingSubscriptions();
    void initializeBlocking().catch((error: unknown) => console.warn("广告拦截状态恢复失败", error));
  });
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if ((changeInfo.status === "loading" || changeInfo.status === "complete") && tab.url) {
      void processUniPassLoginTab(tabId, tab.url).catch((error: unknown) => console.warn("UniPass 登录辅助失败", error));
    }
    if (changeInfo.status === "complete" && tab.url && isJupiterUrl(tab.url)) {
      void syncStoredJupiterSessionToTab(tabId).catch((error: unknown) => console.warn("木星会话同步失败", error));
    }
  });
  chrome.tabs.onRemoved.addListener((tabId) => { void clearUniPassLoginForTab(tabId); });
  // The action intentionally opens the original in-page Shadow DOM overlay.
  chrome.action.onClicked.addListener((tab) => {
    if (tab.id == null) return;
    void togglePageOverlay(tab.id).catch((error: unknown) => console.warn("UniPass 页面浮层打开失败", error));
  });
}

const UNIPASS_MESSAGE_TYPES = new Set<string>([
  "session", "openCredentialPage", "pageContext", "pageTheme", "openApp", "fillFromOverlay", "fillFromPopup",
  "startUniPassLogin", "completeUniPassLogin", "getPluginVersionSettings", "setPluginVersionOverride",
  "getBlockingStatus", "getBlockingSiteState", "pauseBlockingForSite", "resumeBlockingForSite", "getCosmeticRules",
  "currentPageCatalog", "accountCatalog", "listApps", "accountsForApp", "appUrl", "credentialAvailability",
  "revealCredential", "getJupiterKeepalive", "setJupiterKeepalive", "listVaultProfiles", "listVaultConnectionStates",
  "listVaultSyncStatuses", "enableLocalUnlock", "unlockVaultLocally", "disableLocalUnlock", "lockVault",
  "testWebDavConnection", "saveWebDavVault", "removeVault", "vaultCatalog", "createVaultApp", "updateVaultApp",
  "deleteVaultApp", "createVaultAccount", "updateVaultAccount", "deleteVaultAccount", "updateVaultCredential",
  "previewBrowserPasswords", "importBrowserPasswords",
]);

export function isUniPassMessage(value: unknown): value is BackgroundRequest {
  return Boolean(value && typeof value === "object" && !Array.isArray(value)
    && typeof (value as { type?: unknown }).type === "string"
    && UNIPASS_MESSAGE_TYPES.has((value as { type: string }).type));
}

export async function handleUniPassMessage(message: unknown, sender: chrome.runtime.MessageSender): Promise<BackgroundResponse> {
  if (!isUniPassMessage(message)) return { ok: false, error: "UniPass 消息格式无效" };
  try {
    return { ok: true, data: await handle(message, sender) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "未知错误" };
  }
}

function handle(message: BackgroundRequest, sender: chrome.runtime.MessageSender = {}): Promise<unknown> {
  switch (message.type) {
    case "session":
      return currentUser().then(popupSessionUserFor);
    case "openCredentialPage":
      return requireVaultManager(sender, () => chrome.tabs.create({ url: chrome.runtime.getURL("passwords.html") }));
    case "pageContext":
      return pageContextFor(sender);
    case "pageTheme":
      return pageThemeFor(sender);
    case "openApp":
      return message.vaultId ? vaultAppUrl(message.vaultId, String(message.appId)).then((url) => chrome.tabs.create({ url })) : withUserScope(message.userScope, () => openApp(message.appId));
    case "fillFromOverlay":
      return requiresUniPassScope(message) ? withUserScope(message.userScope ?? "", () => fillFromOverlay(sender, message)) : fillFromOverlay(sender, message);
    case "fillFromPopup":
      return requiresUniPassScope(message) ? withUserScope(message.userScope ?? "", () => fillFromPopup(message)) : fillFromPopup(message);
    case "startUniPassLogin":
      return startUniPassLogin();
    case "completeUniPassLogin":
      return completeUniPassLogin();
    case "getPluginVersionSettings":
      return pluginVersionSettings();
    case "setPluginVersionOverride":
      return setPluginVersionOverride(message.version);
    case "getBlockingStatus":
      return getBlockingStatus();
    case "getBlockingSiteState":
      return currentSiteState(sender);
    case "pauseBlockingForSite":
      return pauseCurrentSite(sender, message.tabId);
    case "resumeBlockingForSite":
      return resumeCurrentSite(sender, message.tabId);
    case "getCosmeticRules":
      return (async () => {
        if (sender.id !== chrome.runtime.id) return { generation: 0, selectors: [], scriptlets: [] };
        const url = sender.url;
        if (!url) return { generation: 0, selectors: [], scriptlets: [] };
        const parsed = new URL(url);
        if (!/^https?:$/.test(parsed.protocol)) return { generation: 0, selectors: [], scriptlets: [] };
        const stored = await chrome.storage.local.get(COSMETIC_STORAGE_KEY);
        const store = validateCosmeticStore(stored[COSMETIC_STORAGE_KEY])
          ? stored[COSMETIC_STORAGE_KEY]
          : createCosmeticStore("", FILTER_GENERATION);
        if (await isSitePaused(parsed.hostname.toLowerCase())) return { generation: store?.generation ?? 0, selectors: [], scriptlets: [] };
        return pageRulesForHost(store, parsed.hostname.toLowerCase());
      })();
    case "currentPageCatalog":
      return (async () => {
        const tab = sender.tab?.id != null ? await chrome.tabs.get(sender.tab.id) : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
        if (!tab?.url || !isHttpsUrl(tab.url)) throw new Error("为保护凭据安全，仅支持 HTTPS 页面填充");
        return refreshAccountCatalog(message.userScope, false, normalizeTargetUrl(tab.url));
      })();
    case "accountCatalog":
      return message.userScope ? refreshAccountCatalog(message.userScope, message.forceRefresh === true) : refreshWebDavCatalog();
    case "listApps":
      return (async () => {
        const legacy = message.userScope ? await appsWithAvailableCredentials(message.keyword, message.userScope) : { apps: [], totalApps: 0, excludedEmptyCredentialApps: 0, excludedVerificationFailureApps: 0, excludedDirectoryFailureApps: 0 };
        const extra = await availableVaultApps(message.keyword);
        const extraApps = extra.apps.map((app) => ({
          id: app.id,
          name: app.name,
          vaultId: app.vaultId,
          appRef: { vaultId: app.vaultId, appId: app.id },
          targets: app.targets,
        }));
        return {
          apps: [...legacy.apps, ...extraApps],
          totalApps: legacy.totalApps + extra.totalApps,
          excludedEmptyCredentialApps: legacy.excludedEmptyCredentialApps + extra.excludedEmptyCredentialApps,
          excludedVerificationFailureApps: legacy.excludedVerificationFailureApps + extra.excludedVerificationFailureApps,
          excludedDirectoryFailureApps: legacy.excludedDirectoryFailureApps + extra.excludedDirectoryFailureApps,
        };
      })();
    case "accountsForApp":
      return message.vaultId ? vaultAccounts(message.vaultId, String(message.appId)) : withUserScope(message.userScope, () => accountsForApp(message.appId));
    case "appUrl":
      return message.vaultId ? vaultAppUrl(message.vaultId, String(message.appId)) : withUserScope(message.userScope, () => appUrlForApp(message.appId));
    case "credentialAvailability":
      return (async () => {
        const refs = message.accountRefs ?? message.accountIds.map((accountId) => ({ vaultId: "legacy-unipass", accountId: String(accountId) }));
        const legacy = refs.filter((ref) => ref.vaultId === "legacy-unipass");
        const extra = refs.filter((ref) => ref.vaultId !== "legacy-unipass");
        const legacyResult = legacy.length ? await withUserScope(message.userScope, () => credentialAvailability(legacy.map((ref) => ref.accountId), message.userScope)) : [];
        const extraResult = await Promise.all(extra.map(async (accountRef) => ({ accountId: accountRef.accountId, accountRef, status: await credentialAvailabilityForRef(accountRef).catch(() => "error" as const) })));
        return [...legacyResult, ...extraResult];
      })();
    case "revealCredential":
      return (async () => {
        assertRevealSource(sender, message.accountRef);
        return credentialForRef(message.accountRef);
      })();
    case "getJupiterKeepalive":
      return withUserScope(message.userScope, () => getJupiterKeepaliveSettings(message.userScope));
    case "setJupiterKeepalive":
      return withUserScope(message.userScope, () => setJupiterKeepalive(message.userScope, message.enabled, message.appId, message.accountId, message.username));
    case "listVaultProfiles":
      return requireVaultManager(sender, listVaultProfiles);
    case "listVaultConnectionStates":
      return requireVaultManager(sender, listVaultConnectionStates);
    case "listVaultSyncStatuses":
      return requireVaultManager(sender, listVaultSyncStatuses);
    case "enableLocalUnlock":
      return requireVaultManager(sender, () => enableLocalUnlock(message.vaultId, message.password));
    case "unlockVaultLocally":
      return requireVaultManager(sender, () => unlockVaultLocally(message.vaultId, message.password));
    case "disableLocalUnlock":
      return requireVaultManager(sender, () => disableLocalUnlock(message.vaultId));
    case "lockVault":
      return requireVaultManager(sender, () => lockVault(message.vaultId));
    case "testWebDavConnection":
      return requireVaultManager(sender, async () => {
        await requestWebDavPermission(message.endpoint);
        try {
          return await testWebDavConnection(message);
        } finally {
          await releaseUnusedWebDavPermission(message.endpoint);
        }
      });
    case "saveWebDavVault":
      return requireVaultManager(sender, async () => {
        await requestWebDavPermission(message.endpoint);
        try {
          return await saveWebDavVault(message);
        } catch (error) {
          await releaseUnusedWebDavPermission(message.endpoint);
          throw error;
        }
      });
    case "removeVault":
      return requireVaultManager(sender, () => removeVault(message.vaultId));
    case "vaultCatalog":
      return requireVaultManager(sender, vaultCatalog);
    case "createVaultApp":
      return requireVaultManager(sender, () => createVaultApp(message.vaultId, message.app));
    case "updateVaultApp":
      return requireVaultManager(sender, () => updateVaultApp(message.vaultId, message.app));
    case "deleteVaultApp":
      return requireVaultManager(sender, () => deleteVaultApp(message.vaultId, message.appId));
    case "createVaultAccount":
      return requireVaultManager(sender, () => createVaultAccount(message.vaultId, message.account));
    case "updateVaultAccount":
      return requireVaultManager(sender, () => updateVaultAccount(message.vaultId, message.account));
    case "deleteVaultAccount":
      return requireVaultManager(sender, () => deleteVaultAccount(message.vaultId, message.accountId));
    case "updateVaultCredential":
      return requireVaultManager(sender, () => updateVaultCredential(message.vaultId, message.accountId, message.credential));
    case "importBrowserPasswords":
      return requireVaultManager(sender, () => importBrowserPasswords(message.vaultId, message.records, message.strategy));
    case "previewBrowserPasswords":
      return requireVaultManager(sender, () => previewBrowserPasswords(message.vaultId, message.records));
    default:
      return Promise.reject(new Error("不支持的扩展请求"));
  }
}

function requireVaultManager<T>(sender: chrome.runtime.MessageSender, operation: () => Promise<T>): Promise<T> {
  if (sender.id !== chrome.runtime.id) return Promise.reject(new Error("Vault 管理请求来源无效"));
  return operation();
}

async function refreshWebDavCatalog(): Promise<Awaited<ReturnType<typeof accountCatalog>>> {
  const webdav = await vaultCatalog();
  return { entries: webdav.entries.map(({ app, accounts }) => ({ appId: app.id, appName: app.name, appUrl: app.targets[0] ? `https://${app.targets[0].host}${app.targets[0].pathPrefix || "/"}` : "", accounts: accounts.map((account) => ({ id: account.id, account: account.username, remark: account.remark, vaultId: account.vaultId, appId: account.appId, accountRef: { vaultId: account.vaultId, accountId: account.id } })), vaultId: app.vaultId, targets: app.targets })), failures: webdav.failures.map((failure) => ({ appId: failure.vaultId, appName: "WebDAV Vault", error: failure.error, vaultId: failure.vaultId })), complete: webdav.failures.length === 0 };
}

function requiresUniPassScope(message: Extract<BackgroundRequest, { type: "fillFromOverlay" | "fillFromPopup" }>): boolean {
  return !message.accountRef || message.accountRef.vaultId === "legacy-unipass";
}

async function refreshAccountCatalog(userScope: string, forceRefresh: boolean, pageUrl?: string): Promise<Awaited<ReturnType<typeof accountCatalog>>> {
  if (forceRefresh) await clearCredentialAvailabilityCache();
  const [result, webdav] = await Promise.all([legacyAccountCatalog(userScope, forceRefresh, pageUrl), vaultCatalog()]);
  const extraEntries = webdav.entries.map(({ app, accounts }) => ({
    appId: app.id,
    appName: app.name,
    appUrl: app.targets[0] ? `https://${app.targets[0].host}${app.targets[0].pathPrefix || "/"}` : "",
    accounts: accounts.map((account) => ({ id: account.id, account: account.username, remark: account.remark, vaultId: account.vaultId, appId: account.appId, accountRef: { vaultId: account.vaultId, accountId: account.id } })),
    vaultId: app.vaultId,
    targets: app.targets,
  }));
  const extraFailures = webdav.failures.map((failure) => ({ appId: failure.vaultId, appName: "WebDAV Vault", error: failure.error, vaultId: failure.vaultId }));
  result.entries.push(...extraEntries);
  result.failures.push(...extraFailures);
  result.complete = result.complete && extraFailures.length === 0;
  await assertCurrentUserScope(userScope);
  return result;
}
