import type { VaultBackend } from "../../shared/vault";
import { exportVaultKey, generateVaultKey, importVaultKey } from "../../shared/vault-crypto";
import { openPersistentMaterial, sealPersistentMaterial, type PersistentSecretEnvelope } from "./persistent-secrets";
import { VaultCore } from "./vault-core";

const PENDING_CREATIONS_KEY = "unipass-vault-pending-creations";
interface PendingCreation { vaultId: string; material: PersistentSecretEnvelope; }

// Called under the service configuration queue. A durable encrypted journal must
// exist before the first remote manifest write; it survives worker termination.
export async function createRecoverableVault(backend: VaultBackend, endpoint: string, username: string, appPassword: string): Promise<{ core: VaultCore; vaultKey: string }> {
  const pending = await readPending();
  let attempt = pending[endpoint];
  const manifest = await backend.getManifest();
  if (manifest && !attempt) throw new Error("目标 WebDAV 目录已有密码库数据。请选择连接已有密码库。");
  if (!attempt) {
    const vaultKey = await exportVaultKey(await generateVaultKey());
    attempt = { vaultId: crypto.randomUUID(), material: await sealPersistentMaterial({ username, appPassword, vaultKey }) };
    pending[endpoint] = attempt;
    await chrome.storage.local.set({ [PENDING_CREATIONS_KEY]: pending });
  }
  // Do not replace an unreadable pending key or trust a different remote Vault.
  const { vaultKey } = await openPersistentMaterial(attempt.material);
  const key = await importVaultKey(vaultKey);
  try {
    const core = manifest ? await VaultCore.open(backend, key) : await VaultCore.create(attempt.vaultId, backend, key);
    if (core.vaultId !== attempt.vaultId) throw new Error("远端 Vault 与待恢复的创建记录不匹配");
    return { core, vaultKey };
  } catch {
    throw new Error("密码库创建尚未确认，本地已保留加密恢复记录。请使用同一 WebDAV 地址再次新建以恢复；不会覆盖已有密码库。");
  }
}

export async function finishPendingCreation(endpoint: string, vaultId: string): Promise<void> {
  const pending = await readPending();
  if (pending[endpoint]?.vaultId !== vaultId) return;
  delete pending[endpoint];
  await chrome.storage.local.set({ [PENDING_CREATIONS_KEY]: pending });
}

async function readPending(): Promise<Record<string, PendingCreation>> {
  const value = (await chrome.storage.local.get(PENDING_CREATIONS_KEY))[PENDING_CREATIONS_KEY];
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("本地密码库创建恢复记录无效");
  return { ...value } as Record<string, PendingCreation>;
}
