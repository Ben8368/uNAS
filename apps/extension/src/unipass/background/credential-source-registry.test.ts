import { beforeEach, describe, expect, it } from "vitest";
import { clearCredentialSources, credentialSourceFor, registerCredentialSource } from "./credential-source-registry";
import { installLegacyCredentialSource } from "./credential-source-composition";

describe("credential source composition", () => {
  beforeEach(() => clearCredentialSources());

  it("can run without Legacy while the WebDAV source boundary remains independent", () => {
    expect(() => credentialSourceFor("legacy-unipass")).toThrow("凭据来源不可用");
    const source = { id: "webdav-test", availability: async () => "available" as const, listAccounts: async () => [], getCredential: async () => ({ username: "u", password: "p" }) };
    registerCredentialSource(source);
    expect(credentialSourceFor("webdav-test")).toBe(source);
  });

  it("registers Legacy only from the composition layer", () => {
    installLegacyCredentialSource();
    expect(credentialSourceFor("legacy-unipass").id).toBe("legacy-unipass");
  });
});
