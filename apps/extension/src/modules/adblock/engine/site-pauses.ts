import {
  BLOCKING_PAUSE_RULE_ID_BASE, BLOCKING_PAUSE_RULE_ID_LIMIT, BLOCKING_PAUSE_STORAGE_KEY,
} from "../contracts";
import { DEFAULT_RESOURCE_TYPES } from "./filter-converter";
import { notifyCosmeticForHosts } from "./cosmetic-notifier";

const PAUSE_DURATION_MS = 10 * 60 * 1_000;
const MAX_PAUSED_SITES = 50;
const hostPattern = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i;
export interface PausedSite { host: string; expiresAt: number; }
export interface BlockingSiteState { host?: string; paused: boolean; expiresAt?: number; }

export async function reconcileSitePauses(): Promise<void> {
  const current = await readPausedSites();
  const active = current.filter((site) => site.expiresAt > Date.now());
  const existing = (await chrome.declarativeNetRequest.getDynamicRules()).some((rule) => rule.id >= BLOCKING_PAUSE_RULE_ID_BASE && rule.id < BLOCKING_PAUSE_RULE_ID_LIMIT);
  if (active.length || existing) await replacePauseRules(active);
  if (active.length !== current.length) {
    await chrome.storage.local.set({ [BLOCKING_PAUSE_STORAGE_KEY]: active });
    await notifyCosmeticForHosts(current.filter((site) => site.expiresAt <= Date.now()).map((site) => site.host), "refreshCosmeticEffects");
  }
}

export async function pauseCurrentSite(sender: chrome.runtime.MessageSender, tabId?: number): Promise<BlockingSiteState> {
  const tab = await currentTab(sender, tabId);
  const host = tab.url ? pageHost(tab.url) : null;
  if (!host) throw new Error("当前页面不是可暂停保护的 HTTP(S) 网站");
  const previous = await readPausedSites();
  const next = [...previous.filter((site) => site.host !== host), { host, expiresAt: Date.now() + PAUSE_DURATION_MS }].slice(-MAX_PAUSED_SITES);
  await replacePauseRules(next);
  try { await chrome.storage.local.set({ [BLOCKING_PAUSE_STORAGE_KEY]: next }); }
  catch (error) { await replacePauseRules(previous).catch(() => {}); throw error; }
  await notifyCosmeticForHosts([host], "clearCosmeticEffects");
  return { host, paused: true, expiresAt: next.find((site) => site.host === host)?.expiresAt };
}

export async function resumeCurrentSite(sender: chrome.runtime.MessageSender, tabId?: number): Promise<BlockingSiteState> {
  const tab = await currentTab(sender, tabId);
  const host = tab.url ? pageHost(tab.url) : null;
  if (!host) throw new Error("当前页面不是可恢复保护的 HTTP(S) 网站");
  const previous = await readPausedSites();
  const next = previous.filter((site) => site.host !== host);
  await replacePauseRules(next);
  try { await chrome.storage.local.set({ [BLOCKING_PAUSE_STORAGE_KEY]: next }); }
  catch (error) { await replacePauseRules(previous).catch(() => {}); throw error; }
  await notifyCosmeticForHosts([host], "refreshCosmeticEffects");
  return { host, paused: false };
}

export async function currentSiteState(sender: chrome.runtime.MessageSender): Promise<BlockingSiteState> {
  const tab = await currentTab(sender);
  const host = tab.url ? pageHost(tab.url) : null;
  if (!host) return { paused: false };
  const site = (await readPausedSites()).find((candidate) => candidate.host === host && candidate.expiresAt > Date.now());
  return site ? { host, paused: true, expiresAt: site.expiresAt } : { host, paused: false };
}

export async function isSitePaused(host: string): Promise<boolean> {
  return (await readPausedSites()).some((site) => site.host === host && site.expiresAt > Date.now());
}

async function replacePauseRules(sites: PausedSite[]): Promise<void> {
  const dnr = chrome.declarativeNetRequest;
  const existing = (await dnr.getDynamicRules()).filter((rule) => rule.id >= BLOCKING_PAUSE_RULE_ID_BASE && rule.id < BLOCKING_PAUSE_RULE_ID_LIMIT);
  const addRules: chrome.declarativeNetRequest.Rule[] = [];
  for (const [index, site] of [...sites].sort((a, b) => a.host.localeCompare(b.host)).entries()) {
    const id = BLOCKING_PAUSE_RULE_ID_BASE + index * 3;
    addRules.push({
      id, priority: 1_000_000, action: { type: "allowAllRequests" },
      condition: { requestDomains: [site.host], resourceTypes: ["main_frame"] },
    });
    addRules.push({
      id: id + 1, priority: 999_999, action: { type: "allowAllRequests" },
      condition: { initiatorDomains: [site.host], resourceTypes: ["sub_frame"] },
    });
    addRules.push({
      id: id + 2, priority: 999_998, action: { type: "allow" },
      condition: { initiatorDomains: [site.host], resourceTypes: DEFAULT_RESOURCE_TYPES.filter((type) => type !== "main_frame") as chrome.declarativeNetRequest.ResourceType[] },
    });
  }
  await dnr.updateDynamicRules({ removeRuleIds: existing.map((rule) => rule.id), addRules });
}

async function readPausedSites(): Promise<PausedSite[]> {
  const stored = await chrome.storage.local.get(BLOCKING_PAUSE_STORAGE_KEY);
  const value = stored[BLOCKING_PAUSE_STORAGE_KEY];
  if (!Array.isArray(value)) return [];
  return value.filter((site): site is PausedSite => Boolean(site && typeof site.host === "string" && validHost(site.host)
    && Number.isFinite(site.expiresAt) && site.expiresAt > 0)).slice(0, MAX_PAUSED_SITES);
}

function validHost(host: string): boolean { return host.length <= 253 && hostPattern.test(host) && !host.includes("..") && !host.startsWith(".") && !host.endsWith("."); }
function pageHost(url: string): string | null {
  try { const parsed = new URL(url); return /^https?:$/.test(parsed.protocol) && validHost(parsed.hostname) ? parsed.hostname.toLowerCase() : null; }
  catch { return null; }
}
async function currentTab(sender: chrome.runtime.MessageSender, tabId?: number): Promise<chrome.tabs.Tab> {
  if (tabId != null && sender.id === chrome.runtime.id) {
    const requested = await chrome.tabs.get(tabId);
    if (pageHost(requested.url ?? "")) return requested;
  }
  if (sender.tab?.id != null && typeof sender.tab.url === "string" && /^https?:$/.test(new URL(sender.tab.url).protocol)) return sender.tab;
  return (await chrome.tabs.query({ active: true, currentWindow: true }))[0]
    ?? Promise.reject(new Error("无法识别当前标签页"));
}
