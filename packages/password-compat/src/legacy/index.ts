/** Embeddable Legacy API. Importing this module never installs Chrome listeners. */
export { accountCatalog, accountsForApp, appUrlForApp, credentialForAccount, currentUser, pluginVersionSettings, setPluginVersionOverride } from "../shared/api";
export { appsWithAvailableCredentials, clearCredentialAvailabilityCache, credentialAvailability } from "../background/credential-availability";
export { getJupiterKeepaliveSettings, setJupiterKeepalive } from "../background/jupiter-keepalive";
export { completeLegacyLogin, startLegacyLogin } from "../background/legacy-login";
export { legacyAccountCatalog } from "../background/legacy-catalog";
export { legacyCredentialSource } from "../background/legacy-credential-source";
export { assertCurrentUserScope, withUserScope } from "../background/user-scope-guard";
// Host packaging contract: the host's runtime-config.json must carry the same store baseline.
export { LEGACY_PLUGIN_VERSION } from "../shared/plugin-version";
export { parseRuntimeConfig } from "../shared/runtime-config";

import { isJupiterUrl } from "../shared/url";
import { JUPITER_KEEPALIVE_ALARM, restoreJupiterKeepaliveAlarm, runKeepJupiterAlive, syncStoredJupiterSessionToTab } from "../background/jupiter-keepalive";
import { clearLegacyLoginForTab, processLegacyLoginTab } from "../background/legacy-login";

let installed = false;

/** The host opts into Legacy events; no standalone Service Worker or AdBlock is imported. */
export function installLegacyLifecycle(): void {
  if (installed) return;
  installed = true;
  void restoreJupiterKeepaliveAlarm().catch(() => console.warn("木星保活恢复失败"));
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === JUPITER_KEEPALIVE_ALARM) void runKeepJupiterAlive().catch(() => console.warn("木星保活失败"));
  });
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if ((changeInfo.status === "loading" || changeInfo.status === "complete") && tab.url) {
      void processLegacyLoginTab(tabId, tab.url).catch(() => console.warn("密码管家登录辅助失败"));
    }
    if (changeInfo.status === "complete" && tab.url && isJupiterUrl(tab.url)) {
      void syncStoredJupiterSessionToTab(tabId).catch(() => console.warn("木星会话同步失败"));
    }
  });
  chrome.tabs.onRemoved.addListener((tabId) => {
    void clearLegacyLoginForTab(tabId).catch(() => console.warn("密码管家登录状态清理失败"));
  });
}
