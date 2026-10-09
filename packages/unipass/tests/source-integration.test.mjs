import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import path from 'node:path';
import { IDBFactory } from 'fake-indexeddb';

async function load(entry) {
  const result = await build({ entryPoints: [path.resolve(entry)], bundle: true, format: 'esm', platform: 'node', write: false });
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
}

test('embedding Legacy does not install a standalone background or start network requests', async () => {
  const original = globalThis.chrome;
  globalThis.chrome = undefined;
  try {
    const legacy = await load('src/legacy/index.ts');
    assert.equal(typeof legacy.installLegacyLifecycle, 'function');
    assert.equal(legacy.legacyCredentialSource.id, 'legacy-unipass');
  } finally { globalThis.chrome = original; }
});

test('concurrent Vault readiness writes preserve both Vaults and a clear', async () => {
  const original = globalThis.chrome;
  let stored = {};
  globalThis.chrome = { storage: { local: {
    async get(key) { await new Promise(resolve => setTimeout(resolve, 1)); return { [key]: structuredClone(stored) }; },
    async set(value) { await new Promise(resolve => setTimeout(resolve, 1)); stored = structuredClone(Object.values(value)[0]); },
  } } };
  try {
    const readiness = await load('src/background/vault/sync-readiness.ts');
    await Promise.all([readiness.markVaultSyncReady('a'), readiness.markVaultSyncReady('b')]);
    assert.equal(await readiness.isVaultSyncReady('a'), true);
    assert.equal(await readiness.isVaultSyncReady('b'), true);
    await Promise.all([readiness.clearVaultSyncReady('a'), readiness.markVaultSyncReady('c')]);
    assert.deepEqual(stored, { b: true, c: true });
  } finally { globalThis.chrome = original; }
});

test('Vault service refuses an unregistered Legacy source without fetching or loading WASM', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('unexpected network request'); };
  try {
    const service = await load('src/background/vault/vault-service.ts');
    await assert.rejects(service.credentialForRef({ vaultId: 'legacy-unipass', accountId: 'fixture' }), /凭据来源不可用/);
  } finally { globalThis.fetch = original; }
});

test('unconfirmed remote creation reuses its encrypted recovery journal and key', async () => {
  const originalChrome = globalThis.chrome;
  const originalIdb = globalThis.indexedDB;
  globalThis.indexedDB = new IDBFactory();
  const local = {};
  globalThis.chrome = { storage: { local: {
    async get(key) { return { [key]: structuredClone(local[key]) }; },
    async set(value) { Object.assign(local, structuredClone(value)); },
  } } };
  const objects = new Map();
  let writes = 0;
  const backend = {
    async connect() {},
    async getManifest() { return objects.get('manifest') ?? null; },
    async list() { return [...objects.values()].map(({ id, revision }) => ({ id, revision })); },
    async get(id) { return objects.get(id) ?? null; },
    async put(id, data) {
      assert.ok(local['unipass-vault-pending-creations'], 'journal precedes remote write');
      writes++;
      objects.set(id, { id, data, revision: 'fixture-revision' });
      throw new Error('synthetic lost write acknowledgement');
    },
    async delete() { throw new Error('unexpected remote delete'); },
  };
  try {
    const creation = await load('src/background/vault/pending-creation.ts');
    const endpoint = 'https://dav.example.test/vault/';
    await assert.rejects(creation.createRecoverableVault(backend, endpoint, 'fixture-user', 'fixture-password'), /创建尚未确认/);
    const journal = structuredClone(local['unipass-vault-pending-creations'][endpoint]);
    assert.equal(JSON.stringify(local).includes('fixture-password'), false);
    const recovered = await creation.createRecoverableVault(backend, endpoint, 'fixture-user', 'fixture-password');
    assert.equal(recovered.core.vaultId, journal.vaultId);
    assert.ok(recovered.vaultKey);
    assert.equal(writes, 1, 'recovery must not replace the manifest');
    await creation.finishPendingCreation(endpoint, recovered.core.vaultId);
    assert.deepEqual(local['unipass-vault-pending-creations'], {});
  } finally {
    globalThis.chrome = originalChrome;
    globalThis.indexedDB = originalIdb;
  }
});

test('missing IndexedDB fails closed instead of persisting an exportable device key', async () => {
  const originalIdb = globalThis.indexedDB;
  globalThis.indexedDB = undefined;
  try {
    const persistent = await load('src/background/vault/persistent-secrets.ts');
    await assert.rejects(persistent.sealPersistentMaterial({ username: 'fixture', appPassword: 'fixture', vaultKey: 'fixture' }), /缺少 IndexedDB/);
  } finally { globalThis.indexedDB = originalIdb; }
});
