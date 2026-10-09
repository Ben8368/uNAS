import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { build } from "esbuild";

async function load(entry) {
  const result = await build({ entryPoints: [entry], bundle: true, platform: "node", format: "esm", write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}

const compiler = await load("src/background/blocking/cosmetic-compiler.ts");
const storeApi = await load("src/background/blocking/cosmetic-store.ts");
const styleApi = await load("src/content/blocking/cosmetic-style.ts");

test("cosmetic compiler keeps generic/site scopes and exceptions separate", () => {
  const result = compiler.compileCosmeticFilters(`[Adblock Plus 2.0]
##.generic-ad
#@#.generic-ad
news.example##.sponsor
news.example#@#.sponsor
news.example,~pay.news.example##.subscription-ad
##input.password
news.example##div:-abp-has(.ad)
news.example##+js(remove-attr, .ad, data-ad)
news.example##+js(unknown, .ad, data-ad)
news.example##+js(remove-attr, .ad)
news.example#?#div.ad`);
  assert.deepEqual(result.globalSelectors, []);
  assert.equal(result.sites.length, 2);
  const scripted = result.sites.find((site) => site.scriptlets.length);
  const scoped = result.sites.find((site) => site.excludedHosts.length);
  assert.deepEqual(scripted.hosts, ["news.example"]);
  assert.deepEqual(scripted.selectors, []);
  assert.deepEqual(scripted.scriptlets.map((scriptlet) => [scriptlet.name, ...scriptlet.args]), [["remove-attr", ".ad", "data-ad"]]);
  assert.deepEqual(scoped.excludedHosts, ["pay.news.example"]);
  assert.deepEqual(scoped.selectors, [".subscription-ad"]);
  assert.deepEqual(result.globalSelectorExceptions, [".generic-ad"]);
  assert.deepEqual(scripted.selectorExceptions, [".sponsor"]);
  assert.ok(result.report.skipped >= 3);
});

test("cosmetic page matching applies selector and scriptlet exceptions to global and site rules", () => {
  const store = storeApi.createCosmeticStore(`##.global-ad
example.com#@#.global-ad
##+js(remove-attr, .global-attr, data-ad)
example.com#@#+js(remove-attr, .global-attr, data-ad)
example.com##.site-ad
example.com#@#.site-ad
example.com,~private.example.com##.scoped-ad`, 7);
  assert.equal(storeApi.validateCosmeticStore(store), true);
  assert.deepEqual(storeApi.pageRulesForHost(store, "www.example.com").selectors, [".scoped-ad"]);
  assert.deepEqual(storeApi.pageRulesForHost(store, "www.example.com").scriptlets, []);
  assert.deepEqual(storeApi.pageRulesForHost(store, "private.example.com").selectors, []);
  assert.deepEqual(storeApi.pageRulesForHost(store, "other.example").selectors, [".global-ad"]);
  assert.deepEqual(storeApi.pageRulesForHost(store, "other.example").scriptlets.map((scriptlet) => [scriptlet.name, ...scriptlet.args]), [["remove-attr", ".global-attr", "data-ad"]]);
});

test("built-in d3ward compatibility selectors work offline and stay host-scoped", () => {
  const store = storeApi.createCosmeticStore("", 7);
  assert.deepEqual(storeApi.pageRulesForHost(store, "www.d3ward.com").selectors, [".adbox.banner_ads.adsbox", ".textads"]);
  assert.deepEqual(storeApi.pageRulesForHost(store, "d3ward.github.io").selectors, [".adbox.banner_ads.adsbox", ".textads"]);
  assert.deepEqual(storeApi.pageRulesForHost(store, "other.example").selectors, []);
});

test("legacy cosmetic store schema is rejected for an atomic subscription refresh", () => {
  const current = storeApi.createCosmeticStore("##.remote-ad", 7);
  const legacy = { ...current, version: 1 };
  delete legacy.globalSelectorExceptions;
  delete legacy.globalScriptletExceptions;
  assert.equal(storeApi.validateCosmeticStore(legacy), false);
});

test("built-in d3ward selectors stay within the bounded CSS budget", () => {
  const remoteSelectors = Array.from({ length: 1_500 }, (_, index) => `##.remote-ad-${index}`).join("\n");
  const store = storeApi.createCosmeticStore(remoteSelectors, 7);
  const selectors = storeApi.pageRulesForHost(store, "d3ward.com").selectors;
  const css = styleApi.buildCosmeticStyle(selectors);
  assert.deepEqual(selectors.slice(0, 2), [".adbox.banner_ads.adsbox", ".textads"]);
  assert.match(css, /:where\(\.adbox\.banner_ads\.adsbox\)/);
  assert.match(css, /:where\(\.textads\)/);
});

test("generated CSS is static, bounded, and protects credentials and uNAS UI", () => {
  const css = styleApi.buildCosmeticStyle([".ad", "input.password", "#unipass-page-overlay", ".sponsor"]);
  assert.match(css, /:where\(\.ad\)/);
  assert.match(css, /:where\(\.sponsor\)/);
  assert.doesNotMatch(css, /input\.password/);
  assert.match(css, /type="password"/);
  assert.match(css, /#unipass-page-overlay/);
  assert.ok(new TextEncoder().encode(css).byteLength < 300_000);
});

test("remote rules cannot become executable scriptlets", async () => {
  const content = (await build({ entryPoints: ["src/content/blocking/cosmetic-content.ts"], bundle: true, platform: "browser", format: "esm", write: false })).outputFiles[0].text;
  assert.doesNotMatch(content, /eval\s*\(|new Function|script\.src|executeScript/);
  assert.match(content, /remove-attr/);
});

test("document_start cosmetic sync retries after the document root exists", async () => {
  const source = await readFile(new URL("../src/content/blocking/cosmetic-content.ts", import.meta.url), "utf8");
  assert.match(source, /document\.addEventListener\("DOMContentLoaded", scheduleSync/);
  assert.match(source, /if \(!document\.documentElement\) \{ scheduleSync\(\); return; \}/);
  assert.match(source, /installCosmeticStyle\([\s\S]*\)\) \{\s*scheduleSync\(\);/);
  assert.match(source, /activeScriptletKey/);
  assert.match(source, /attributeFilter/);
  assert.doesNotMatch(source, /\.observe\(document\.documentElement, \{ childList: true, subtree: true \}\)/);
});
