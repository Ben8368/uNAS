import { VaultConflictError, type StoredObject, type VaultBackend, type VaultObjectKind } from "../../shared/vault";
import { EncryptedVaultCache } from "./local-cache";

export interface VaultSyncStatus {
  state: "synced" | "offline" | "conflict" | "pending";
  dirty: number;
  conflicts: number;
}
export interface VaultSyncResult extends VaultSyncStatus { uploaded: number; downloaded: number; }

const syncQueues = new Map<string, Promise<unknown>>();

/** Reconciles opaque encrypted objects; it never decrypts them. */
export class VaultSyncEngine {
  constructor(private readonly cache: EncryptedVaultCache, private readonly remote: VaultBackend) {}

  synchronize(): Promise<VaultSyncResult> {
    return this.exclusive(() => this.runSynchronize());
  }

  private exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const previous = syncQueues.get(this.cache.vaultId) ?? Promise.resolve();
    const task = previous.catch(() => undefined).then(operation);
    syncQueues.set(this.cache.vaultId, task);
    return task.finally(() => { if (syncQueues.get(this.cache.vaultId) === task) syncQueues.delete(this.cache.vaultId); });
  }

  private async runSynchronize(): Promise<VaultSyncResult> {
    const progress = { uploaded: 0, downloaded: 0 };
    try {
      await this.remote.connect();
      for (const record of await this.cache.records()) {
        if (record.syncState !== "dirty") continue;
        try {
          const stored = await this.remote.put(record.id, record.data, record.remoteRevision);
          await this.cache.markUploaded(record.id, record.localRevision, stored.revision);
          progress.uploaded += 1;
        } catch (error) {
          if (error instanceof VaultConflictError || isConflict(error)) await this.cache.markConflict(record.id, record.localRevision, record.remoteRevision);
          else throw error;
        }
      }
      await this.runPull(() => { progress.downloaded += 1; });
      return { ...(await this.status()), ...progress };
    } catch {
      return { ...(await this.status()), state: "offline", ...progress };
    }
  }

  pull(): Promise<number> { return this.exclusive(() => this.runPull()); }

  private async runPull(onDownloaded: () => void = () => {}): Promise<number> {
    const remoteMetas = await this.remote.list();
    const remoteIds = new Set(remoteMetas.map((meta) => meta.id));
    const downloads: Array<{ object: StoredObject; kind?: VaultObjectKind; expectedLocalRevision: string | null }> = [];
    let downloaded = 0;
    for (const meta of remoteMetas) {
      const local = await this.cache.record(meta.id);
      if (local?.remoteRevision === meta.revision) continue;
      if (!local || local.syncState === "clean") {
        const object = await this.remote.get(meta.id);
        // A listed object disappearing mid-pull is an incomplete snapshot, not
        // a successful sync. Keep staged downloads uncommitted and retry later.
        if (!object) throw new Error("远端 Vault 对象在同步期间不可用，请重试");
        downloads.push({ object, kind: meta.kind ?? kindFor(meta.id), expectedLocalRevision: local?.localRevision ?? null });
        continue;
      }
      await this.cache.markConflict(meta.id, local.localRevision, local.remoteRevision);
    }
    for (const local of await this.cache.records()) if (!remoteIds.has(local.id) && local.remoteRevision) await this.cache.markConflict(local.id, local.localRevision, local.remoteRevision);
    for (const download of downloads) {
      if (await this.cache.acceptRemoteIfUnchanged(download.object, download.kind, download.expectedLocalRevision)) {
        downloaded += 1;
        onDownloaded();
      }
    }
    return downloaded;
  }

  async status(): Promise<VaultSyncStatus> {
    const records = await this.cache.records();
    const dirty = records.filter((record) => record.syncState === "dirty").length;
    const conflicts = records.filter((record) => record.syncState === "conflict").length;
    return { state: conflicts ? "conflict" : dirty ? "pending" : "synced", dirty, conflicts };
  }
}

function kindFor(id: string): VaultObjectKind | undefined { if (id === "manifest") return "manifest"; if (id.startsWith("app_")) return "app"; if (id.startsWith("account_")) return "account"; if (id.startsWith("credential_")) return "credential"; return undefined; }
function isConflict(value: unknown): boolean { return value instanceof Error && (value as Error & { code?: unknown }).code === "revision-conflict"; }
