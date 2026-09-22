import type { RevisionToken, StoredObject, StoredObjectMeta, VaultBackend, VaultObjectKind } from "../../shared/vault";

export type SyncState = "clean" | "dirty" | "conflict";

export interface CachedVaultObject extends StoredObject {
  vaultId: string;
  remoteRevision?: RevisionToken;
  syncState: SyncState;
  updatedAt: number;
  kind?: VaultObjectKind;
}

interface CacheRecord extends CachedVaultObject { localRevision: RevisionToken; }
export interface VaultCacheStore {
  get(vaultId: string, id: string): Promise<CacheRecord | undefined>;
  list(vaultId: string): Promise<CacheRecord[]>;
  put(value: CacheRecord): Promise<void>;
  update(vaultId: string, id: string, change: (current: CacheRecord | undefined) => CacheRecord | null): Promise<boolean>;
  clear(vaultId: string): Promise<void>;
}

const DB_NAME = "unipass-encrypted-vault-cache-v1";
const STORE_NAME = "objects";

/** Local VaultBackend implementation. It persists only opaque AES-GCM envelopes. */
export class EncryptedVaultCache implements VaultBackend {
  constructor(readonly vaultId: string, private readonly store: VaultCacheStore = new IndexedDbVaultCacheStore()) {}

  async connect(): Promise<void> { await this.store.list(this.vaultId); }
  async getManifest(): Promise<StoredObject | null> { return this.get("manifest"); }
  async list(): Promise<StoredObjectMeta[]> {
    return (await this.store.list(this.vaultId)).map((value) => ({ id: value.id, revision: value.localRevision, kind: value.kind }));
  }
  async get(id: string): Promise<StoredObject | null> {
    const value = await this.store.get(this.vaultId, id);
    return value ? stored(value) : null;
  }
  async put(id: string, data: Uint8Array, expectedRevision?: RevisionToken): Promise<StoredObjectMeta> {
    const next = localRevision();
    await this.store.update(this.vaultId, id, (current) => {
      if (expectedRevision ? current?.localRevision !== expectedRevision : Boolean(current)) throw new Error("Local Vault cache revision conflict");
      return {
        vaultId: this.vaultId, id, revision: next, data: data.slice(), localRevision: next,
        remoteRevision: current?.remoteRevision, syncState: "dirty", updatedAt: Date.now(), kind: kindFor(id),
      };
    });
    return { id, revision: next, kind: kindFor(id) };
  }
  async delete(id: string, expectedRevision: RevisionToken): Promise<void> {
    // Vault Core uses encrypted tombstones; physical deletion is not a normal path.
    await this.put(id, new Uint8Array(), expectedRevision);
  }
  async records(): Promise<CacheRecord[]> { return this.store.list(this.vaultId); }
  async record(id: string): Promise<CacheRecord | undefined> { return this.store.get(this.vaultId, id); }
  async acceptRemoteIfUnchanged(object: StoredObject, kind: VaultObjectKind | undefined, expectedLocalRevision: RevisionToken | null): Promise<boolean> {
    return this.store.update(this.vaultId, object.id, (current) => {
      if (expectedLocalRevision === null ? Boolean(current) : current?.localRevision !== expectedLocalRevision || current.syncState !== "clean") return null;
      return remoteRecord(this.vaultId, object, kind);
    });
  }
  async markUploaded(id: string, uploadedLocalRevision: RevisionToken, remoteRevision: RevisionToken): Promise<void> {
    await this.store.update(this.vaultId, id, (current) => {
      if (!current) throw new Error("Local Vault cache object is missing");
      if (current.syncState !== "dirty") return null;
      return { ...current, remoteRevision,
        syncState: current.localRevision === uploadedLocalRevision ? "clean" : "dirty", updatedAt: Date.now() };
    });
  }
  async markConflict(id: string, expectedLocalRevision: RevisionToken, expectedRemoteRevision?: RevisionToken): Promise<void> {
    await this.store.update(this.vaultId, id, (current) => {
      if (!current) throw new Error("Local Vault cache object is missing");
      if (current.localRevision !== expectedLocalRevision || current.remoteRevision !== expectedRemoteRevision) return null;
      return { ...current, syncState: "conflict", updatedAt: Date.now() };
    });
  }
  async clear(): Promise<void> { await this.store.clear(this.vaultId); }
}

/** Test-only cache store; production uses IndexedDB. */
export class MemoryVaultCacheStore implements VaultCacheStore {
  private readonly values = new Map<string, CacheRecord>();
  async get(vaultId: string, id: string): Promise<CacheRecord | undefined> { const value = this.values.get(key(vaultId, id)); return value && copy(value); }
  async list(vaultId: string): Promise<CacheRecord[]> { return [...this.values.values()].filter((value) => value.vaultId === vaultId).map(copy); }
  async put(value: CacheRecord): Promise<void> { this.values.set(key(value.vaultId, value.id), copy(value)); }
  async update(vaultId: string, id: string, change: (current: CacheRecord | undefined) => CacheRecord | null): Promise<boolean> {
    const storageKey = key(vaultId, id);
    const current = this.values.get(storageKey);
    const next = change(current && copy(current));
    if (!next) return false;
    this.values.set(storageKey, copy(next));
    return true;
  }
  async clear(vaultId: string): Promise<void> { for (const value of await this.list(vaultId)) this.values.delete(key(vaultId, value.id)); }
}

class IndexedDbVaultCacheStore implements VaultCacheStore {
  async get(vaultId: string, id: string): Promise<CacheRecord | undefined> { return this.request("readonly", (store) => store.get([vaultId, id])); }
  async list(vaultId: string): Promise<CacheRecord[]> {
    const database = await databaseFor();
    try {
      return await new Promise((resolve, reject) => {
        const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll(IDBKeyRange.bound([vaultId, ""], [vaultId, "\uffff"]));
        request.onsuccess = () => resolve((request.result as CacheRecord[]).map(copy));
        request.onerror = () => reject(request.error ?? new Error("Unable to read local Vault cache"));
      });
    } finally { database.close(); }
  }
  async put(value: CacheRecord): Promise<void> { await this.request("readwrite", (store) => store.put(copy(value))); }
  async update(vaultId: string, id: string, change: (current: CacheRecord | undefined) => CacheRecord | null): Promise<boolean> {
    const database = await databaseFor();
    try {
      return await new Promise<boolean>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        let applied = false;
        let failure: unknown;
        transaction.oncomplete = () => resolve(applied);
        transaction.onerror = () => reject(failure ?? transaction.error ?? new Error("Local Vault cache update failed"));
        transaction.onabort = () => reject(failure ?? transaction.error ?? new Error("Local Vault cache update aborted"));
        const request = store.get([vaultId, id]);
        request.onsuccess = () => {
          try {
            const current = request.result as CacheRecord | undefined;
            const next = change(current && copy(current));
            if (next) { store.put(copy(next)); applied = true; }
          } catch (error) { failure = error; transaction.abort(); }
        };
      });
    } finally { database.close(); }
  }
  async clear(vaultId: string): Promise<void> { for (const item of await this.list(vaultId)) await this.request("readwrite", (store) => store.delete([vaultId, item.id])); }
  private async request<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const database = await databaseFor();
    try { return await new Promise<T>((resolve, reject) => { const request = action(database.transaction(STORE_NAME, mode).objectStore(STORE_NAME)); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error ?? new Error("Local Vault cache operation failed")); }); }
    finally { database.close(); }
  }
}

function databaseFor(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") throw new Error("IndexedDB is unavailable; encrypted local Vault cache cannot start");
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => { const store = request.result.createObjectStore(STORE_NAME, { keyPath: ["vaultId", "id"] }); store.createIndex("vaultId", "vaultId", { unique: false }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open local Vault cache"));
  });
}
function stored(value: CacheRecord): StoredObject { return { id: value.id, revision: value.localRevision, data: value.data.slice(), kind: value.kind }; }
function remoteRecord(vaultId: string, object: StoredObject, kind?: VaultObjectKind): CacheRecord {
  const revision = localRevision();
  return { vaultId, id: object.id, revision, data: object.data.slice(), localRevision: revision,
    remoteRevision: object.revision, syncState: "clean", updatedAt: Date.now(), kind: kind ?? kindFor(object.id) };
}
function copy(value: CacheRecord): CacheRecord { return { ...value, data: value.data.slice() }; }
function key(vaultId: string, id: string): string { return `${vaultId}\u0000${id}`; }
function localRevision(): string { return crypto.randomUUID(); }
function kindFor(id: string): VaultObjectKind | undefined { if (id === "manifest") return "manifest"; if (id.startsWith("app_")) return "app"; if (id.startsWith("account_")) return "account"; if (id.startsWith("credential_")) return "credential"; return undefined; }
