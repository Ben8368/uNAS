import { afterEach, describe, expect, it, vi } from "vitest";
import { handleUniPassMessage } from "./service-worker";
import { isAuthorizedOverlayRequest } from "./page-overlay";

const pageSender = { id: "unas-test", url: "https://ads.example.test/", tab: { id: 3 }, frameId: 0 } as chrome.runtime.MessageSender;

describe("UniPass privileged message authorization", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("rejects Vault mutation and popup fill requests from the ad page sender", async () => {
    vi.stubGlobal("chrome", { runtime: { id: "unas-test" } });
    await expect(handleUniPassMessage({ type: "removeVault", vaultId: "vault" }, pageSender)).resolves.toEqual({ ok: false, error: "Vault 管理请求来源无效" });
    await expect(handleUniPassMessage({ type: "saveWebDavVault", mode: "create", name: "x", endpoint: "https://dav.example/", username: "u", appPassword: "p" }, pageSender)).resolves.toEqual({ ok: false, error: "Vault 管理请求来源无效" });
    await expect(handleUniPassMessage({ type: "updateVaultCredential", vaultId: "vault", accountId: "account", credential: { password: "p" } }, pageSender)).resolves.toEqual({ ok: false, error: "Vault 管理请求来源无效" });
    await expect(handleUniPassMessage({ type: "fillFromPopup", tabId: 3, accountId: "account", accountRef: { vaultId: "vault", accountId: "account" }, expectedAppUrl: "https://example.test/" }, pageSender)).resolves.toEqual({ ok: false, error: "填充请求来源无效" });
    await expect(handleUniPassMessage({ type: "refreshBlockingSubscriptions" }, pageSender)).resolves.toEqual({ ok: false, error: "规则更新请求来源无效" });
  });

  it("keeps the original overlay fill route distinct from popup fill", async () => {
    vi.stubGlobal("chrome", { runtime: { id: "unas-test" } });
    const response = await handleUniPassMessage({ type: "fillFromOverlay", accountId: "account", accountRef: { vaultId: "vault", accountId: "account" }, expectedAppUrl: "https://example.test/" }, pageSender);
    expect(response.ok).toBe(false);
    expect(response).not.toEqual({ ok: false, error: "填充请求来源无效" });
  });

  it("accepts the overlay manager handoff only with the action capability", async () => {
    vi.stubGlobal("chrome", {
      runtime: { id: "unas-test" },
      storage: { session: { get: vi.fn(async () => ({ "unipass-overlay-tokens-v1": { "3": { token: "capability", documentId: "document-1" } } })) } },
    });
    const sender = { id: "unas-test", url: "https://portal.unipass.top/synthetic-login", tab: { id: 3 }, frameId: 0, documentId: "document-1" } as chrome.runtime.MessageSender;
    await expect(isAuthorizedOverlayRequest(sender, "capability")).resolves.toBe(true);
    await expect(isAuthorizedOverlayRequest(sender, "wrong")).resolves.toBe(false);
    await expect(isAuthorizedOverlayRequest({ ...sender, documentId: "other" }, "capability")).resolves.toBe(false);
  });
});
