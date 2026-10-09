const SYNC_READINESS_KEY = "unipass-vault-sync-readiness";
// Readiness is one shared map, even when sync jobs belong to different Vaults.
let mutationTail: Promise<void> = Promise.resolve();
function mutateReadiness(change: (readiness: Record<string, boolean>) => void): Promise<void> {
  const result = mutationTail.then(async () => {
    const stored = (await chrome.storage.local.get(SYNC_READINESS_KEY))[SYNC_READINESS_KEY];
    const readiness = stored && typeof stored === "object" && !Array.isArray(stored)
      ? { ...(stored as Record<string, boolean>) } : {};
    change(readiness);
    await chrome.storage.local.set({ [SYNC_READINESS_KEY]: readiness });
  });
  mutationTail = result.then(() => undefined, () => undefined);
  return result;
}

export async function isVaultSyncReady(vaultId: string): Promise<boolean> {
  const value = (await chrome.storage.local.get(SYNC_READINESS_KEY))[SYNC_READINESS_KEY];
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && (value as Record<string, unknown>)[vaultId] === true);
}

export function markVaultSyncReady(vaultId: string): Promise<void> {
  return mutateReadiness((readiness) => { readiness[vaultId] = true; });
}

export function clearVaultSyncReady(vaultId: string): Promise<void> {
  return mutateReadiness((readiness) => { delete readiness[vaultId]; });
}
