import { describe, expect, it } from "vitest";
import { isUniPassSender } from "./extensionAdapter";

const extensionId = "unas-test";
const page = { id: extensionId, url: "https://ads.example.test/frame", tab: { id: 7 }, frameId: 0 };

describe("UniPass message source boundary", () => {
  it("allows cosmetic rules in a child frame only for the exact cosmetic request", () => {
    expect(isUniPassSender({ ...page, frameId: 4 }, extensionId, { type: "getCosmeticRules" })).toBe(true);
    expect(isUniPassSender({ ...page, frameId: 4 }, extensionId, { type: "getCosmeticRules", extra: "no" })).toBe(false);
    expect(isUniPassSender({ ...page, frameId: 4 }, extensionId, { type: "getBlockingStatus" })).toBe(false);
    expect(isUniPassSender({ ...page, frameId: 4 }, extensionId, { type: "removeVault", vaultId: "vault" })).toBe(false);
  });

  it("keeps Vault-capable requests on top-level extension pages", () => {
    expect(isUniPassSender({ id: extensionId, url: "chrome-extension://unas-test/workspace.html", frameId: 0 }, extensionId, { type: "removeVault", vaultId: "vault" })).toBe(true);
    expect(isUniPassSender({ ...page, frameId: 0 }, extensionId, { type: "removeVault", vaultId: "vault" })).toBe(true);
    expect(isUniPassSender({ ...page, frameId: 0 }, extensionId, { type: "fillFromPopup", tabId: 7, accountId: "a", expectedAppUrl: "https://example.test" })).toBe(true);
  });
});
