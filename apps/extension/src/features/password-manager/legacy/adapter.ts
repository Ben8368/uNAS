import { legacyCredentialSource, installLegacyLifecycle } from "@unas/password-compat/legacy";
import { registerCredentialSource } from "../background/credential-source-registry";

// This is the sole production import of the internal password compatibility package.
// WebDAV Vault and the extension UI depend on local contracts, never its bootstrap.
export {
  accountCatalog, accountsForApp, appUrlForApp, credentialForAccount, currentUser,
  pluginVersionSettings, setPluginVersionOverride, appsWithAvailableCredentials,
  clearCredentialAvailabilityCache, credentialAvailability, getJupiterKeepaliveSettings,
  setJupiterKeepalive, completeLegacyLogin, startLegacyLogin, legacyAccountCatalog,
  assertCurrentUserScope, withUserScope,
} from "@unas/password-compat/legacy";

export function installLegacyCredentialSource(): void {
  registerCredentialSource(legacyCredentialSource);
}

export function installLegacyAdapter(): void {
  installLegacyCredentialSource();
  installLegacyLifecycle();
}
