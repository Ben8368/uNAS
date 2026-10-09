import { legacyCredentialSource, installLegacyLifecycle } from "../../../../../../sources/UniPass/src/legacy/index";
import { registerCredentialSource } from "../background/credential-source-registry";

// This is the sole production import of the pinned UniPass source repository.
// WebDAV Vault and the extension UI depend on local contracts, never its bootstrap.
export {
  accountCatalog, accountsForApp, appUrlForApp, credentialForAccount, currentUser,
  pluginVersionSettings, setPluginVersionOverride, appsWithAvailableCredentials,
  clearCredentialAvailabilityCache, credentialAvailability, getJupiterKeepaliveSettings,
  setJupiterKeepalive, completeUniPassLogin, startUniPassLogin, legacyAccountCatalog,
  assertCurrentUserScope, withUserScope,
} from "../../../../../../sources/UniPass/src/legacy/index";

export function installLegacyCredentialSource(): void {
  registerCredentialSource(legacyCredentialSource);
}

export function installLegacyAdapter(): void {
  installLegacyCredentialSource();
  installLegacyLifecycle();
}
