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
import { fillFromOverlay, fillFromPopup, isAuthorizedOverlayRequest, openApp, pageContextFor, pageThemeFor, togglePageOverlay } from "./page-overlay";
import { assertRevealSource } from "./credential-access";
import { legacyAccountCatalog } from "./legacy-catalog";
import { installLegacyCredentialSource } from "./credential-source-composition";
import { assertCurrentUserScope, withUserScope } from "./user-scope-guard";
import type { BackgroundRequest, BackgroundResponse } from "../shared/types";
import { isExtensionPageSender } from "../../../shared/sender-guard";

const TRUSTED_EXTENSION_UI_PATHS = ["/newtab.html", "/workspace.html", "/popup.html", "/manage.html"] as const;

const VAULT_SYNC_ALARM = "unipass-vault-sync";
let installed = false;

/** Register password manager lifecycle hooks inside uNAS's single MV3 background entry. */
export function installPasswordManagerBackground(): void {
  if (installed) return;
  installed = true;
  installLegacyCredentialSource();
  void chrome.alarms.create(VAULT_SYNC_ALARM, { periodInMinutes: 5 });
  void syncAllVaults().catch(() => { /* offline startup is expected; the cache remains authoritative */ });
  void restoreJupiterKeepaliveAlarm().catch((error: unknown) => console.warn("木星保活恢复失败", error));

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === JUPITER_KEEPALIVE_ALARM) void runKeepJupiterAlive();
    if (alarm.name === VAULT_SYNC_ALARM) void syncAllVaults();
  });
  chrome.runtime.onStartup.addListener(() => {
    void syncAllVaults();
  });
  chrome.runtime.onInstalled.addListener(() => {
  });
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if ((changeInfo.status === "loading" || changeInfo.status === "complete") && tab.url) {
      void processUniPassLoginTab(tabId, tab.url).catch((error: unknown) => console.warn("密码管家登录辅助失败", error));
    }
    if (changeInfo.status === "complete" && tab.url && isJupiterUrl(tab.url)) {
      void syncStoredJupiterSessionToTab(tabId).catch((error: unknown) => console.warn("木星会话同步失败", error));
    }
  });
  chrome.tabs.onRemoved.addListener((tabId) => { void clearUniPassLoginForTab(tabId); });
  // The action intentionally opens the original in-page Shadow DOM overlay.
  chrome.action.onClicked.addListener((tab) => {
    if (tab.id == null) return;
    void togglePageOverlay(tab.id).catch((error: unknown) => console.warn("密码浮窗打开失败", error));
  });
}

const UNIPASS_MESSAGE_TYPES = new Set<string>([
  "session", "pageContext", "pageTheme", "openApp", "fillFromOverlay", "fillFromPopup",
  "startUniPassLogin", "completeUniPassLogin", "getPluginVersionSettings", "setPluginVersionOverride",
  "currentPageCatalog", "accountCatalog", "listApps", "accountsForApp", "appUrl", "credentialAvailability",
  "revealCredential", "getJupiterKeepalive", "setJupiterKeepalive", "listVaultProfiles", "listVaultConnectionStates",
  "listVaultSyncStatuses", "syncVaults", "enableLocalUnlock", "unlockVaultLocally", "disableLocalUnlock", "lockVault",
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
  if (!isUniPassMessage(message)) return { ok: false, error: "密码管家消息格式无效" };
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
    case "pageContext":
      return pageContextFor(sender);
    case "pageTheme":
      return pageThemeFor(sender);
    case "openApp":
      return message.vaultId ? vaultAppUrl(message.vaultId, String(message.appId)).then((url) => chrome.tabs.create({ url })) : withUserScope(message.userScope, () => openApp(message.appId));
    case "fillFromOverlay":
      return requiresUniPassScope(message) ? withUserScope(message.userScope ?? "", () => fillFromOverlay(sender, message)) : fillFromOverlay(sender, message);
    case "fillFromPopup":
      return requireVaultUiPage(sender, () => requiresUniPassScope(message)
        ? withUserScope(message.userScope ?? "", () => fillFromPopup(message))
        : fillFromPopup(message));
    case "startUniPassLogin":
      return startUniPassLogin();
    case "completeUniPassLogin":
      return completeUniPassLogin();
    case "getPluginVersionSettings":
      return pluginVersionSettings();
    case "setPluginVersionOverride":
      return setPluginVersionOverride(message.version);
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
      return requireVaultManager(sender, message.overlayToken, listVaultProfiles);
    case "listVaultConnectionStates":
      return requireVaultManager(sender, message.overlayToken, listVaultConnectionStates);
    case "listVaultSyncStatuses":
      return requireVaultManager(sender, message.overlayToken, listVaultSyncStatuses);
    case "syncVaults":
      return requireVaultManager(sender, message.overlayToken, syncAllVaults);
    case "enableLocalUnlock":
      return requireVaultManager(sender, message.overlayToken, () => enableLocalUnlock(message.vaultId, message.password));
    case "unlockVaultLocally":
      return requireVaultManager(sender, message.overlayToken, () => unlockVaultLocally(message.vaultId, message.password));
    case "disableLocalUnlock":
      return requireVaultManager(sender, message.overlayToken, () => disableLocalUnlock(message.vaultId));
    case "lockVault":
      return requireVaultManager(sender, message.overlayToken, () => lockVault(message.vaultId));
    case "testWebDavConnection":
      return requireVaultManager(sender, message.overlayToken, async () => {
        await requestWebDavPermission(message.endpoint);
        try {
          return await testWebDavConnection(message);
        } finally {
          await releaseUnusedWebDavPermission(message.endpoint);
        }
      });
    case "saveWebDavVault":
      return requireVaultManager(sender, message.overlayToken, async () => {
        await requestWebDavPermission(message.endpoint);
        try {
          return await saveWebDavVault(message);
        } catch (error) {
          await releaseUnusedWebDavPermission(message.endpoint);
          throw error;
        }
      });
    case "removeVault":
      return requireVaultManager(sender, message.overlayToken, () => removeVault(message.vaultId));
    case "vaultCatalog":
      return requireVaultManager(sender, message.overlayToken, vaultCatalog);
    case "createVaultApp":
      return requireVaultManager(sender, message.overlayToken, () => createVaultApp(message.vaultId, message.app));
    case "updateVaultApp":
      return requireVaultManager(sender, message.overlayToken, () => updateVaultApp(message.vaultId, message.app));
    case "deleteVaultApp":
      return requireVaultManager(sender, message.overlayToken, () => deleteVaultApp(message.vaultId, message.appId));
    case "createVaultAccount":
      return requireVaultManager(sender, message.overlayToken, () => createVaultAccount(message.vaultId, message.account));
    case "updateVaultAccount":
      return requireVaultManager(sender, message.overlayToken, () => updateVaultAccount(message.vaultId, message.account));
    case "deleteVaultAccount":
      return requireVaultManager(sender, message.overlayToken, () => deleteVaultAccount(message.vaultId, message.accountId));
    case "updateVaultCredential":
      return requireVaultManager(sender, message.overlayToken, () => updateVaultCredential(message.vaultId, message.accountId, message.credential));
    case "importBrowserPasswords":
      return requireVaultManager(sender, message.overlayToken, () => importBrowserPasswords(message.vaultId, message.records, message.strategy));
    case "previewBrowserPasswords":
      return requireVaultManager(sender, message.overlayToken, () => previewBrowserPasswords(message.vaultId, message.records));
    default:
      return Promise.reject(new Error("不支持的扩展请求"));
  }
}

function requireVaultManager<T>(sender: chrome.runtime.MessageSender, overlayToken: string | undefined, operation: () => Promise<T>): Promise<T> {
  if (isExtensionPageSender(sender, chrome.runtime.id, TRUSTED_EXTENSION_UI_PATHS)) return operation();
  return isAuthorizedOverlayRequest(sender, overlayToken).then((authorized) => authorized
    ? operation()
    : Promise.reject(new Error("Vault 管理请求来源无效")));
}

function requireVaultUiPage<T>(sender: chrome.runtime.MessageSender, operation: () => Promise<T>): Promise<T> {
  if (!isExtensionPageSender(sender, chrome.runtime.id, ["/popup.html", "/manage.html"])) return Promise.reject(new Error("填充请求来源无效"));
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
