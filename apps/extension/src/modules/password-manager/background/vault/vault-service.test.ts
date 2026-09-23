import { afterEach, describe, expect, it, vi } from "vitest";
import { clearCredentialSources } from "../credential-source-registry";
import { listVaultProfiles, vaultCatalog } from "./vault-service";

describe("WebDAV Vault without Legacy", () => {
  afterEach(() => {
    clearCredentialSources();
    vi.unstubAllGlobals();
  });

  it("ignores unimplemented providers without deleting their stored data", async () => {
    const stored = [
      { id: "dav", name: "DAV", backend: "webdav", enabled: true, endpoint: "https://dav.example/" },
      ...["github", "cloudflare", "legacy-unipass"].map(backend => ({ id: backend, name: backend, backend, enabled: true, endpoint: "https://dav.example/" })),
    ];
    const set = vi.fn();
    vi.stubGlobal("chrome", { storage: { local: { get: vi.fn(async () => ({ "unipass-vault-profiles": stored })), set } } });
    await expect(listVaultProfiles()).resolves.toEqual([stored[0]]);
    expect(set).not.toHaveBeenCalled();
    expect(stored).toHaveLength(4);
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
