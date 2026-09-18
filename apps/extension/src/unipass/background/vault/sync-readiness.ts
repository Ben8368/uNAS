const SYNC_READINESS_KEY = "unipass-vault-sync-readiness";

export async function isVaultSyncReady(vaultId: string): Promise<boolean> {
  const value = (await chrome.storage.local.get(SYNC_READINESS_KEY))[SYNC_READINESS_KEY];
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && (value as Record<string, unknown>)[vaultId] === true);
}

export async function markVaultSyncReady(vaultId: string): Promise<void> {
  const stored = (await chrome.storage.local.get(SYNC_READINESS_KEY))[SYNC_READINESS_KEY];
  const readiness = stored && typeof stored === "object" && !Array.isArray(stored) ? stored as Record<string, boolean> : {};
  await chrome.storage.local.set({ [SYNC_READINESS_KEY]: { ...readiness, [vaultId]: true } });
}

export async function clearVaultSyncReady(vaultId: string): Promise<void> {
  const stored = (await chrome.storage.local.get(SYNC_READINESS_KEY))[SYNC_READINESS_KEY];
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return;
  const readiness = { ...(stored as Record<string, boolean>) };
  delete readiness[vaultId];
  await chrome.storage.local.set({ [SYNC_READINESS_KEY]: readiness });
}
