export type CosmeticEffectMessage = "clearCosmeticEffects" | "refreshCosmeticEffects";

export async function notifyCosmeticForHosts(hosts: string[], type: CosmeticEffectMessage): Promise<void> {
  if (!hosts.length) return;
  const allowed = new Set(hosts);
  await notifyTabs((tab) => Boolean(tab.url && allowed.has(pageHost(tab.url) ?? "")), type);
}

export async function refreshOpenCosmeticEffects(): Promise<void> {
  await notifyTabs((tab) => Boolean(tab.url && pageHost(tab.url)), "refreshCosmeticEffects");
}

async function notifyTabs(matches: (tab: chrome.tabs.Tab) => boolean, type: CosmeticEffectMessage): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});
    await Promise.all(tabs.filter((tab) => tab.id != null && matches(tab))
      .map((tab) => chrome.tabs.sendMessage(tab.id!, { type }).catch(() => {})));
  } catch { /* DNR and persisted state remain authoritative if a tab cannot be notified. */ }
}

function pageHost(url: string): string | null {
  try {
    const parsed = new URL(url);
    return /^https?:$/.test(parsed.protocol) ? parsed.hostname.toLowerCase() : null;
  } catch { return null; }
}
