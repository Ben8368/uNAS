import { appUrlForApp, credentialForAccount } from "../shared/api";
import { credentialForRef } from "./vault/vault-service";
import { appUrlMatches, isHttpsUrl, vaultTargetMatches } from "../shared/url";
import type { BackgroundRequest, FillRequest, FillResult, PageContext, PageTheme } from "../shared/types";
import { detectPageTheme } from "../shared/page-theme";
import { assertCurrentUserScope } from "./user-scope-guard";
import { fillTargetForAccount } from "./credential-access";

const OVERLAY_TOKEN_KEY = "unipass-overlay-tokens-v1";
const OVERLAY_TOKEN_GLOBAL = "__unas_unipass_overlay_token__";

export async function pageContextFor(sender: chrome.runtime.MessageSender): Promise<PageContext> {
  const tab = sender.tab;
  if (tab?.id == null || !tab.url) throw new Error("无法识别当前页面");
  return { tabId: tab.id, url: tab.url };
}

export async function pageThemeFor(sender: chrome.runtime.MessageSender): Promise<PageTheme> {
  const tab = sender.tab?.id != null ? sender.tab : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (!tab?.id || !tab.url || !isHttpsUrl(tab.url)) return "light";
  try {
    const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: detectPageTheme });
    return result?.result === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export async function openApp(appId: string | number): Promise<void> {
  await chrome.tabs.create({ url: await appUrlForApp(appId) });
}

export async function togglePageOverlay(tabId: number): Promise<void> {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.url || !isHttpsUrl(tab.url)) return;
  const token = crypto.randomUUID();
  const [marker] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (key: string, value: string) => { (globalThis as Record<string, unknown>)[key] = value; },
    args: [OVERLAY_TOKEN_GLOBAL, token],
  });
  if (!marker?.documentId) throw new Error("无法确认浮层页面");
  const tokens = await readOverlayTokens();
  tokens[String(tabId)] = { token, documentId: marker.documentId };
  await chrome.storage.session.set({ [OVERLAY_TOKEN_KEY]: tokens });
  await chrome.scripting.executeScript({ target: { tabId }, files: ["page-overlay.js"] });
}

export async function isAuthorizedOverlayRequest(sender: chrome.runtime.MessageSender, token: string | undefined): Promise<boolean> {
  if (!token || sender.tab?.id == null || !sender.documentId) return false;
  const record = (await readOverlayTokens())[String(sender.tab.id)];
  return record?.token === token && record.documentId === sender.documentId;
}

async function readOverlayTokens(): Promise<Record<string, { token: string; documentId: string }>> {
  const stored = (await chrome.storage.session.get(OVERLAY_TOKEN_KEY))[OVERLAY_TOKEN_KEY];
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
  return stored as Record<string, { token: string; documentId: string }>;
}

export async function fillFromOverlay(
  sender: chrome.runtime.MessageSender,
  message: Extract<BackgroundRequest, { type: "fillFromOverlay" }>,
): Promise<FillResult> {
  const tabId = sender.tab?.id;
  if (tabId == null) throw new Error("无法确认当前页面");
  return fillIntoTab(tabId, message);
}

export async function fillFromPopup(
  message: Extract<BackgroundRequest, { type: "fillFromPopup" }>,
): Promise<FillResult> {
  return fillIntoTab(message.tabId, message);
}

async function fillIntoTab(
  tabId: number,
  message: Pick<Extract<BackgroundRequest, { type: "fillFromOverlay" }>, "accountId" | "accountRef" | "expectedAppUrl" | "userScope">,
): Promise<FillResult> {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.active || !tab.url || !isHttpsUrl(tab.url) || !appUrlMatches(message.expectedAppUrl, tab.url)) {
    return { ok: false, usernameFilled: false, passwordFilled: false, error: "当前标签页已切换或不属于该应用，已取消填充" };
  }
  const requiresScope = !message.accountRef || message.accountRef.vaultId === "legacy-unipass";
  const target = await fillTargetForAccount(message.accountRef ?? { vaultId: "legacy-unipass", accountId: String(message.accountId) }, tab.url);
  const matches = (url: string): boolean => target.targets
    ? target.targets.some((item) => vaultTargetMatches(item, url))
    : appUrlMatches(target.expectedAppUrl, url);
  let credential: { username: string; password: string } | null = null;
  try {
    if (message.accountRef) credential = await credentialForRef(message.accountRef);
    else credential = await credentialForAccount(message.accountId);
    // Filling is a non-rollbackable side effect. Re-check after the credential
    // request and again immediately before the injection so a session switch
    // cannot be detected only after the old user's password was written.
    if (requiresScope) await assertCurrentUserScope(message.userScope ?? "");
    const current = await chrome.tabs.get(tabId);
    if (!current.active || !current.url || !matches(current.url)) {
      return { ok: false, usernameFilled: false, passwordFilled: false, error: "获取凭据期间标签页已切换或离开该应用，已取消填充" };
    }
    const [injection] = await chrome.scripting.executeScript({ target: { tabId }, files: ["content-script.js"] });
    if (!injection?.documentId) throw new Error("无法确认凭据填充页面");
    if (requiresScope) await assertCurrentUserScope(message.userScope ?? "");
    const finalTab = await chrome.tabs.get(tabId);
    if (!finalTab.active || !finalTab.url || !matches(finalTab.url)) throw new Error("当前页面已切换，已取消填充");
    return await chrome.tabs.sendMessage<FillRequest, FillResult>(tabId, {
      type: "fillCredentials",
      credential,
      ...target,
      mode: "all",
    }, { documentId: injection.documentId });
  } finally {
    if (credential) {
      credential.username = "";
      credential.password = "";
      // Clear the local reference after zeroizing both fields.
      // eslint-disable-next-line no-useless-assignment
      credential = null;
    }
  }
}
