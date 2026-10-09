import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const bundled = await build({
  entryPoints: ["src/background/legacy-catalog.ts"], bundle: true, format: "esm", platform: "node", write: false,
  plugins: [{ name: "catalog-fixture", setup(builder) {
    builder.onResolve({ filter: /shared\/api$/ }, () => ({ path: "api", namespace: "fixture" }));
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: `
      export const accountCatalog = pageUrl => globalThis.fixture.fetchCatalog(pageUrl);
      export const currentUser = async () => ({ id: globalThis.fixture.user });
    `, loader: "js" }));
  } }],
});
let sequence = 0;
async function setup() {
  const data = {};
  let calls = 0;
  globalThis.fixture = { user: "one", fetchCatalog: async () => {
    calls++;
    return { complete: true, failures: [], entries: [{ appId: "a", appName: "App", appUrl: "https://example.com/", accounts: [{ id: "1", account: "demo", password: "must-not-cache", token: "must-not-cache" }] }] };
  } };
  globalThis.chrome = { storage: { session: {
    get: async key => structuredClone({ [key]: data[key] }),
    set: async values => Object.assign(data, structuredClone(values)),
  } } };
  const module = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text + `\n// ${sequence++}`).toString("base64")}`);
  return { ...module, data, calls: () => calls };
}

test("reopening and concurrent overlays reuse one complete Legacy catalog without credentials", async () => {
  const f = await setup();
  const [a, b] = await Promise.all([f.legacyAccountCatalog("user:one"), f.legacyAccountCatalog("user:one")]);
  a.entries.push({ appId: "webdav" });
  assert.equal(b.entries.length, 1);
  await f.legacyAccountCatalog("user:one");
  assert.equal(f.calls(), 1);
  assert.doesNotMatch(JSON.stringify(f.data), /must-not-cache|password|token/);
});

test("Worker restart reuses session cache; expiry and manual refresh fetch new catalogs", async () => {
  const f = await setup();
  await f.legacyAccountCatalog("user:one");
  const saved = structuredClone(f.data);
  const restarted = await setup();
  Object.assign(restarted.data, saved);
  await restarted.legacyAccountCatalog("user:one");
  assert.equal(restarted.calls(), 0);
  await restarted.legacyAccountCatalog("user:one", true);
  assert.equal(restarted.calls(), 1);
  Object.values(restarted.data)[0].expiresAt = Date.now() - 1;
  await restarted.legacyAccountCatalog("user:one");
  assert.equal(restarted.calls(), 2);
});

test("partial refresh preserves last complete cache and remains explicitly incomplete", async () => {
  const f = await setup();
  await f.legacyAccountCatalog("user:one");
  const saved = structuredClone(f.data);
  fixture.fetchCatalog = async () => ({ entries: [], failures: [{ appId: "a", error: "offline" }], complete: false });
  assert.equal((await f.legacyAccountCatalog("user:one", true)).complete, false);
  assert.deepEqual(f.data, saved);
});

test("a switched identity cannot read another user's cached catalog", async () => {
  const f = await setup();
  await f.legacyAccountCatalog("user:one");
  fixture.user = "two";
  await assert.rejects(f.legacyAccountCatalog("user:one"), /用户已切换/);
  await f.legacyAccountCatalog("user:two");
  assert.equal(f.calls(), 2);
  assert.equal(Object.keys(f.data).length, 2);
});

test("identity change during network loading prevents cache writes", async () => {
  const f = await setup();
  const load = fixture.fetchCatalog;
  fixture.fetchCatalog = async () => { const result = await load(); fixture.user = "two"; return result; };
  await assert.rejects(f.legacyAccountCatalog("user:one"), /用户已切换/);
  assert.deepEqual(f.data, {});
});

test("failed requests are not cached and can be retried", async () => {
  const f = await setup();
  const load = fixture.fetchCatalog;
  fixture.fetchCatalog = async () => { throw new Error("offline"); };
  await assert.rejects(f.legacyAccountCatalog("user:one"), /offline/);
  assert.deepEqual(f.data, {});
  fixture.fetchCatalog = load;
  assert.equal((await f.legacyAccountCatalog("user:one")).complete, true);
});

test("manual refresh waits for an older in-flight request then fetches again", async () => {
  const f = await setup();
  const load = fixture.fetchCatalog;
  let release;
  const wait = new Promise(resolve => { release = resolve; });
  fixture.fetchCatalog = async () => { await wait; return load(); };
  const initial = f.legacyAccountCatalog("user:one");
  const forced = f.legacyAccountCatalog("user:one", true);
  release();
  await Promise.all([initial, forced]);
  assert.equal(f.calls(), 2);
});


test("page-scoped catalogs cannot overwrite or satisfy another page or the full directory", async () => {
  const f = await setup();
  const pages = [];
  const load = fixture.fetchCatalog;
  fixture.fetchCatalog = async pageUrl => { pages.push(pageUrl); return load(); };
  await f.legacyAccountCatalog("user:one", false, "https://first.example/");
  await f.legacyAccountCatalog("user:one", false, "https://second.example/");
  await f.legacyAccountCatalog("user:one");
  await f.legacyAccountCatalog("user:one", false, "https://first.example/");
  assert.deepEqual(pages, ["https://first.example/", "https://second.example/", undefined]);
});
