import { afterEach, describe, expect, it, vi } from "vitest";
import { clearCredentialSources } from "../credential-source-registry";
import { listVaultProfiles, vaultCatalog } from "./vault-service";

describe("WebDAV Vault without Legacy", () => {
  afterEach(() => {
    clearCredentialSources();
    vi.unstubAllGlobals();
  });

  it("builds and serves the empty WebDAV catalog when Legacy is disabled", async () => {
    vi.stubGlobal("chrome", {
      storage: {
        local: { get: vi.fn(async () => ({})) },
        session: { get: vi.fn(async () => ({})) },
      },
    });
    await expect(listVaultProfiles()).resolves.toEqual([]);
    await expect(vaultCatalog()).resolves.toEqual({ entries: [], failures: [] });
  });
});
