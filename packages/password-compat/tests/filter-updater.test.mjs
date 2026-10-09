import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
const built = await build({ entryPoints: ["src/background/blocking/filter-updater.ts"], bundle: true, platform: "node", format: "esm", write: false });
const { updateFilterSubscriptions, fetchFilterList } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString("base64")}`);
const KEY = "unipass_filter_update";

test("URL subscriptions refresh atomically, preserve offline rules and retry; no raw lists stored", async () => {
  const originalChrome = globalThis.chrome, originalFetch = globalThis.fetch;
  let stored = {}, rules = [{ id: 7, action: { type: "block" } }], fetches = [], messages = [], revision = "one", rejectDnr = false, failNetwork = false;
  let alarm;
  globalThis.chrome = {
    alarms: { async create(name, info) { alarm = {name, ...info}; } },
    storage: { local: { async get() {return stored;}, async set(value) {stored = value;} } },
    tabs: {
      async query() { return [{ id: 8, url: "https://news.example/" }, { id: 9, url: "chrome://extensions/" }]; },
      async sendMessage(tabId, message) { messages.push([tabId, message.type]); },
    },
    declarativeNetRequest: {
      async getDynamicRules() { return rules; },
      async updateDynamicRules({removeRuleIds,addRules}) {
        if (rejectDnr) throw Error("invalid rule");
        rules = [...rules.filter(rule => !removeRuleIds.includes(rule.id)), ...addRules];
      },
    },
  };
  globalThis.fetch = async (url, options) => {
    fetches.push(url);
    assert.equal(options.credentials, "omit");
    assert.equal(options.redirect, "error");
    if (failNetwork && url.includes("easylistchina")) throw Error("offline");
    const host = new URL(url).pathname.split("/").at(-1).replace(".txt", "");
    return new Response(`[Adblock Plus 2.0]\n||${host}-${revision}.example^\n@@||${host}-${revision}.example/required.js$script\n`);
  };
  try {
    await Promise.all([updateFilterSubscriptions(),updateFilterSubscriptions()]);
    assert.equal(fetches.length,4);
    assert.ok(fetches.includes("https://easylist-downloads.adblockplus.org/easylist.txt"));
    assert.ok(fetches.includes("https://easylist-downloads.adblockplus.org/easyprivacy.txt"));
    assert.equal(alarm.periodInMinutes,60);
    assert.equal(stored[KEY].ruleCount,5);
    assert.equal(rules.length,6);
    assert.deepEqual(Object.keys(stored[KEY]).sort(),["checkedAt","generation","ruleCount","updatedAt"]);
    assert.equal(stored[KEY].generation,3);
    assert.deepEqual(messages, [[8, "refreshCosmeticEffects"]]);
    await updateFilterSubscriptions();
    assert.equal(fetches.length,4,"fresh rules must not redownload when worker wakes");
    delete stored[KEY].generation;
    await updateFilterSubscriptions();
    assert.equal(fetches.length,8,"upgrades must refresh even when the previous generation is recent");
    assert.deepEqual(messages, [[8, "refreshCosmeticEffects"], [8, "refreshCosmeticEffects"]]);
    const expire = () => { stored[KEY].updatedAt = Date.now()-3_600_001; };
    expire(); revision="two"; failNetwork=true;
    const previous = structuredClone(rules);
    await updateFilterSubscriptions();
    assert.deepEqual(rules, previous,"partial/offline refresh must retain all previous rules");
    assert.ok(stored[KEY].error);
    assert.equal(messages.length, 2, "failed updates must not disturb open-page cosmetic effects");
    failNetwork=false; rejectDnr=true;
    await updateFilterSubscriptions();
    assert.deepEqual(rules,previous,"Chrome validation failure must retain previous generation");
    rejectDnr=false;
    await updateFilterSubscriptions();
    assert.equal(stored[KEY].error,undefined);
    assert.ok(rules.slice(1).every(rule => (rule.condition.urlFilter ?? rule.condition.requestDomains.join(",")).includes("two.example")));
    assert.equal(rules[0].id,7);
    expire(); globalThis.fetch=async()=>new Response("<html>upstream error</html>");
    const latest=structuredClone(rules);
    await updateFilterSubscriptions();
    assert.deepEqual(rules,latest);
  } finally {globalThis.chrome=originalChrome;globalThis.fetch=originalFetch;}
});

test("large subscriptions compact before quota validation while unrelated dynamic rules keep their budget", async () => {
  const originalChrome = globalThis.chrome, originalFetch = globalThis.fetch;
  let stored = {}, rules = [], installs = 0;
  globalThis.chrome = {
    alarms: { async create() {} },
    storage: { local: { async get() { return stored; }, async set(value) { stored = value; } } },
    declarativeNetRequest: {
      async getDynamicRules() { return rules; },
      async updateDynamicRules({ addRules }) { installs++; rules = addRules; },
    },
  };
  globalThis.fetch = async () => new Response("[Adblock Plus 2.0]\n" + Array.from({ length: 30_010 }, (_, i) => `||ads${i}.example^`).join("\n"));
  try {
    await updateFilterSubscriptions();
    assert.equal(installs, 1);
    assert.equal(rules.length, 61);
    assert.equal(rules.flatMap(rule => rule.condition.requestDomains).length, 30_010);
    stored[KEY].updatedAt = 0;
    rules = [...rules, ...Array.from({ length: 29_950 }, (_, i) => ({ id: i + 1, action: { type: "block" } }))];
    await updateFilterSubscriptions();
    assert.equal(installs, 1, "quota overflow must not invoke a partial replacement");
    assert.ok(stored[KEY].error);
  } finally { globalThis.chrome = originalChrome; globalThis.fetch = originalFetch; }
});

test("subscription downloads accept HTML literals in filters but reject HTML responses and oversized bodies", async () => {
  const originalFetch=globalThis.fetch;
  try {
    const valid = "[Adblock Plus 3.1]\n||ads.example^\nfandom.com#$#replace-fetch-response '/<!doctype html>.*/' ''";
    globalThis.fetch=async()=>new Response(valid);
    assert.equal(await fetchFilterList("https://example.test/list"), valid);
    globalThis.fetch=async()=>new Response("<html>error</html>");
    await assert.rejects(fetchFilterList("https://example.test/list"), /订阅格式无效/);
    globalThis.fetch=async()=>new Response("[Adblock Plus 2.0]\n||ads.example^",{headers:{"content-type":"text/html"}});
    await assert.rejects(fetchFilterList("https://example.test/list"),/订阅响应无效/);
    globalThis.fetch=async()=>new Response("[Adblock Plus 2.0]\n"+"!".repeat(5*1024*1024));
    await assert.rejects(fetchFilterList("https://example.test/list"),/订阅文件过大/);
  } finally {globalThis.fetch=originalFetch;}
});
