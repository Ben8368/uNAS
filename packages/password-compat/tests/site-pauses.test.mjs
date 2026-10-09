import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const result = await build({ entryPoints: ["src/background/blocking/site-pauses.ts"], bundle: true, platform: "node", format: "esm", write: false });
const pauses = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);

test("site pause is user-scoped, temporary, and synchronizes all DNR layers", async () => {
  const original = globalThis.chrome;
  let stored = {};
  let dynamic = [];
  const messages = [];
  globalThis.chrome = {
    storage: { local: {
      async get(key) { return { [key]: stored[key] }; },
      async set(value) { stored = { ...stored, ...value }; },
    } },
    tabs: {
      async query() { return [{ id: 42, active: true, url: "https://news.example/path" }, { id: 43, url: "https://news.example/other" }, { id: 44, url: "https://other.example/" }]; },
      async sendMessage(tabId, message) { messages.push([tabId, message.type]); },
    },
    declarativeNetRequest: {
      async getDynamicRules() { return dynamic; },
      async updateDynamicRules({ removeRuleIds, addRules }) { dynamic = [...dynamic.filter((rule) => !removeRuleIds.includes(rule.id)), ...(addRules ?? [])]; },
    },
  };
  try {
    const paused = await pauses.pauseCurrentSite({});
    assert.equal(paused.host, "news.example");
    assert.equal(paused.paused, true);
    assert.equal(dynamic.length, 3);
    assert.equal(dynamic[0].action.type, "allowAllRequests");
    assert.deepEqual(dynamic[0].condition.requestDomains, ["news.example"]);
    assert.deepEqual(dynamic[0].condition.resourceTypes, ["main_frame"]);
    assert.equal(dynamic[1].action.type, "allowAllRequests");
    assert.deepEqual(dynamic[1].condition.initiatorDomains, ["news.example"]);
    assert.deepEqual(dynamic[1].condition.resourceTypes, ["sub_frame"]);
    assert.equal(dynamic[2].action.type, "allow");
    assert.deepEqual(dynamic[2].condition.initiatorDomains, ["news.example"]);
    assert.ok(dynamic[2].condition.resourceTypes.includes("script"));
    assert.ok(!dynamic[2].condition.resourceTypes.includes("main_frame"));
    assert.deepEqual(messages, [[42, "clearCosmeticEffects"], [43, "clearCosmeticEffects"]]);
    assert.equal(await pauses.isSitePaused("news.example"), true);
    const resumed = await pauses.resumeCurrentSite({});
    assert.deepEqual(resumed, { host: "news.example", paused: false });
    assert.deepEqual(dynamic, []);
    assert.equal(await pauses.isSitePaused("news.example"), false);
    assert.deepEqual(messages.slice(2), [[42, "refreshCosmeticEffects"], [43, "refreshCosmeticEffects"]]);
  } finally { globalThis.chrome = original; }
});

test("expired or malformed pause state is removed without creating a permanent allow rule", async () => {
  const original = globalThis.chrome;
  let stored = { unipass_blocking_paused_sites: [
    { host: "expired.example", expiresAt: Date.now() - 1 },
    { host: "https://evil.example", expiresAt: Date.now() + 10_000 },
  ] };
  let dynamic = [{ id: 110_000_000, action: { type: "allowAllRequests" } }];
  const messages = [];
  globalThis.chrome = {
    storage: { local: { async get() { return stored; }, async set(value) { stored = { ...stored, ...value }; } } },
    tabs: {
      async query() { return [{ id: 7, url: "https://expired.example/path" }, { id: 8, url: "https://other.example/" }]; },
      async sendMessage(tabId, message) { messages.push([tabId, message.type]); },
    },
    declarativeNetRequest: {
      async getDynamicRules() { return dynamic; },
      async updateDynamicRules({ removeRuleIds, addRules }) { dynamic = [...dynamic.filter((rule) => !removeRuleIds.includes(rule.id)), ...(addRules ?? [])]; },
    },
  };
  try {
    await pauses.reconcileSitePauses();
    assert.deepEqual(stored.unipass_blocking_paused_sites, []);
    assert.deepEqual(dynamic, []);
    assert.deepEqual(messages, [[7, "refreshCosmeticEffects"]]);
  } finally { globalThis.chrome = original; }
});
