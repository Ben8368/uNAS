import { legacyCredentialSource } from "./legacy-credential-source";
import { registerCredentialSource } from "./credential-source-registry";

/** Install optional compatibility adapters at the application composition root. */
export function installLegacyCredentialSource(): void {
  registerCredentialSource(legacyCredentialSource);
}
