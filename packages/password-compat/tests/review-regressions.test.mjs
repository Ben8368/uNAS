import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import path from 'node:path';

async function load(entry, modules = {}) {
  const plugins = [{ name: 'fixture-boundaries', setup(b) {
    b.onResolve({ filter: /.*/ }, args => modules[args.path] ? { path: args.path, namespace: 'fixture' } : undefined);
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: modules[args.path], loader: 'js' }));
  } }];
  const r = await build({ entryPoints: [path.resolve(entry)], bundle: true, format: 'esm', platform: 'node', write: false, plugins });
  return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
}
const fixtureModules = {
  '../shared/api': `export async function accountCatalog(){return globalThis.fixture.catalog;} export async function credentialForAccount(){globalThis.fixture.reads++; return {username:'fixture-user',password:'fixture-password'};} export async function appUrlForApp(){return 'https://app.example/login';}`,
  './vault/vault-service': `export async function targetsForAccountRef(){return globalThis.fixture.targets;} export async function credentialForRef(){globalThis.fixture.reads++; return {username:'fixture-user',password:'fixture-password'};}`,
  './user-scope-guard': `export async function assertCurrentUserScope(){}`,
};
const access = await load('src/background/credential-access.ts', fixtureModules);
const fill = await load('src/background/page-overlay.ts', fixtureModules);
function reset() {
  globalThis.fixture = { reads: 0, targets: [{scheme:'https',host:'app.example',pathPrefix:'/login'}], catalog:{complete:true, entries:[{appUrl:'https://app.example/login',accounts:[{id:'legacy-account'}]}]}, sent:[] };
  globalThis.chrome = { runtime:{id:'fixture-id',getURL:p=>`chrome-extension://fixture-id/${p}`}, tabs:{async get(){return {id:1,active:true,url:fixture.url || 'https://app.example/login'};},async sendMessage(id,message){fixture.sent.push(structuredClone(message));return {ok:true};}}, scripting:{async executeScript(){if(fixture.navigate)fixture.url=fixture.navigate;return [{documentId:'fixture-document'}];}} };
}
test('fill rejects caller-selected wrong origins before reading a credential', async () => {
  reset(); fixture.url='https://unrelated.example/login';
  await assert.rejects(fill.fillFromPopup({tabId:1,accountRef:{vaultId:'vault',accountId:'account'},expectedAppUrl:fixture.url}), /不属于/);
  assert.equal(fixture.reads,0); assert.equal(fixture.sent.length,0);
});
test('fill resolves Vault targets and aborts a navigation after injection', async () => {
  reset(); const message={tabId:1,accountRef:{vaultId:'vault',accountId:'account'},expectedAppUrl:'https://app.example/login'};
  await fill.fillFromPopup(message);
  assert.equal(fixture.sent[0].credential.password,'fixture-password');
  assert.deepEqual(fixture.sent[0].targets,fixture.targets);
  reset(); fixture.navigate='https://unrelated.example/login';
  await assert.rejects(fill.fillFromPopup(message), /切换/); assert.equal(fixture.sent.length,0);
});
test('Legacy fill ownership uses complete server directory and rejects foreign accounts', async () => {
  reset();
  assert.equal((await access.fillTargetForAccount({vaultId:'legacy-unipass',accountId:'legacy-account'},'https://app.example/login')).expectedAppUrl,'https://app.example/login');
  await assert.rejects(access.fillTargetForAccount({vaultId:'legacy-unipass',accountId:'other-account'},'https://app.example/login'),/不属于/);
  fixture.catalog.complete=false;
  await assert.rejects(access.fillTargetForAccount({vaultId:'legacy-unipass',accountId:'legacy-account'},'https://app.example/login'),/完整验证/);
});
test('Reveal accepts only the own extension password page and WebDAV references', () => {
  reset(); const ref={vaultId:'vault',accountId:'account'};
  for(const url of ['https://app.example/','chrome-extension://fixture-id/manage.html','chrome-extension://other/popup.html']) assert.throws(()=>access.assertRevealSource({id:'fixture-id',url},ref),/账号详情/);
  const sender={id:'fixture-id',url:chrome.runtime.getURL('popup.html'),tab:{id:2}};
  assert.doesNotThrow(()=>access.assertRevealSource(sender,ref));
  assert.throws(()=>access.assertRevealSource(sender,{vaultId:'legacy-unipass',accountId:'x'}),/WebDAV/);
});

const cacheApi = await load('src/background/vault/local-cache.ts');
const syncApi = await load('src/background/vault/sync-engine.ts');
const cryptoApi = await load('src/shared/vault-crypto.ts');
const coreApi = await load('src/background/vault/vault-core.ts');
const importer = await load('src/shared/import/normalize.ts');
const urlApi = await load('src/shared/url.ts');
test('concurrent sync instances upload an identical revision only once', async () => {
  const cache=new cacheApi.EncryptedVaultCache('fixture-vault',new cacheApi.MemoryVaultCacheStore());
  const id='app_1234567890123456'; await cache.put(id,new Uint8Array([1])); let writes=0;
  const remote={async connect(){},async list(){return [{id,revision:'r1'}];},async put(){writes++;return {revision:'r1'};},async get(){throw new Error('unexpected download');}};
  const results=await Promise.all([new syncApi.VaultSyncEngine(cache,remote).synchronize(),new syncApi.VaultSyncEngine(cache,remote).synchronize()]);
  assert.equal(writes,1);assert.equal((await cache.record(id)).syncState,'clean');assert.ok(results.every(r=>r.state==='synced'));
});
test('stale conflict reports do not overwrite a newer local edit', async () => {
  const cache=new cacheApi.EncryptedVaultCache('fixture-conflict',new cacheApi.MemoryVaultCacheStore());
  const id='app_1234567890123456';await cache.put(id,new Uint8Array([1]));const old=await cache.record(id);
  await cache.put(id,new Uint8Array([2]),old.localRevision);
  await cache.markConflict(id,old.localRevision,old.remoteRevision);
  assert.equal((await cache.record(id)).syncState,'dirty');
});
test('Vault target lookup uses account ownership and rejects deleted accounts', async () => {
  const cache=new cacheApi.EncryptedVaultCache('fixture-targets',new cacheApi.MemoryVaultCacheStore());
  const core=new coreApi.VaultCore('fixture-targets',cache,await cryptoApi.generateVaultKey());await core.initialize();
  const app=await core.createApp({name:'Fixture',targets:[{scheme:'https',host:'app.example'}]});
  const account=await core.createAccount({appId:app.id,username:'fixture-user',password:'fixture-password'});
  const ref={vaultId:'fixture-targets',accountId:account.id};assert.deepEqual(await core.targetsForAccount(ref),app.targets);
  await core.deleteAccount(account.id);await assert.rejects(core.targetsForAccount(ref),/删除/);
});
test('CSV rejects unsupported ports and Vault matching never crosses port origins', () => {
  for(const port of [8443,9443])assert.equal(importer.normalizeBrowserPasswordRecord({url:`https://app.example:${port}/login`,username:'fixture-user',password:'fixture-password'}),null);
  assert.ok(importer.normalizeBrowserPasswordRecord({url:'https://app.example:443/login',username:'fixture-user',password:'fixture-password'}));
  assert.equal(urlApi.vaultTargetMatches({scheme:'https',host:'app.example'},'https://app.example:8443/login'),false);
});

function domFixture() {
  const elements=new Map();
  const get=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',hidden:false,disabled:false,classList:{add(){},remove(){}},replaceChildren(){},closest(){return {setAttribute(){},removeAttribute(){}};}});return elements.get(id);};
  globalThis.document={querySelector:selector=>get(selector.slice(1))};
  globalThis.window={dispatchEvent(){},setInterval(){return 1;},setTimeout(){return 2;},clearInterval(){},clearTimeout(){}};
  return get;
}
test('overlay controller refuses Reveal before sending a message', async () => {
  const get=domFixture();let calls=0;globalThis.chrome={runtime:{async sendMessage(){calls++;}}};let error;
  const {CredentialController}=await load('src/popup/credentials.ts');
  await new CredentialController(text=>error=text,()=>null,true).reveal('vault:account');
  assert.equal(calls,0);assert.match(error,/扩展账号详情/);assert.equal(get('credentialPassword').value,'');
});
test('successful import preserves completion summary while clearing plaintext references', async () => {
  const get=domFixture();globalThis.chrome={runtime:{async sendMessage(){return {ok:true,data:{added:1,skipped:0,failed:[],sync:{state:'synced'}}};}}};
  const {BrowserPasswordImportController}=await load('src/popup/import-passwords.ts');const controller=new BrowserPasswordImportController(()=>{});
  const record={url:'https://app.example',username:'fixture-user',password:'fixture-password'};controller.records=[record];get('browserImportVault').value='vault';get('browserImportStrategy').value='skip';
  await controller.import();assert.equal(record.password,'');assert.equal(controller.records.length,0);
  assert.match(get('browserImportSummary').textContent,/成功导入：1/);assert.match(get('browserImportSummary').textContent,/删除 CSV/);assert.equal(get('startBrowserImport').hidden,true);assert.equal(get('cancelBrowserImport').textContent,'完成');
});
