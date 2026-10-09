import { legacyCredentialSource, installLegacyLifecycle } from "unipass-extension/legacy";
import { registerCredentialSource } from "../background/credential-source-registry";

// This is the sole production import of the UniPass workspace package.
// WebDAV Vault and the extension UI depend on local contracts, never its bootstrap.
export {
  accountCatalog, accountsForApp, appUrlForApp, credentialForAccount, currentUser,
  pluginVersionSettings, setPluginVersionOverride, appsWithAvailableCredentials,
  clearCredentialAvailabilityCache, credentialAvailability, getJupiterKeepaliveSettings,
  setJupiterKeepalive, completeUniPassLogin, startUniPassLogin, legacyAccountCatalog,
  assertCurrentUserScope, withUserScope,
} from "unipass-extension/legacy";

export function installLegacyCredentialSource(): void {
  registerCredentialSource(legacyCredentialSource);
}

export function installLegacyAdapter(): void {
  installLegacyCredentialSource();
  installLegacyLifecycle();
}
