import type { CredentialSource } from "./credential-source";

const sources = new Map<string, CredentialSource>();

/**
 * Runtime composition boundary for optional credential backends.
 *
 * Vault code only asks this registry for a source.  The registry deliberately
 * starts empty so a build can omit the Legacy adapter without changing the
 * WebDAV Vault dependency graph.
 */
export function registerCredentialSource(source: CredentialSource): void {
  sources.set(source.id, source);
}

export function unregisterCredentialSource(id: string): void {
  sources.delete(id);
}

export function clearCredentialSources(): void {
  sources.clear();
}

export function credentialSourceFor(id: string): CredentialSource {
  const source = sources.get(id);
  if (!source) throw new Error(`凭据来源不可用：${id}`);
  return source;
}

export function credentialSourceAvailabilityFor(id: string): CredentialSource["availability"] {
  return credentialSourceFor(id).availability;
}
