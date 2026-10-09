import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { build } from "esbuild";
import { convertFilterList, PROTECTED_INITIATOR_DOMAINS } from "../scripts/convert-filter-rules.mjs";

const manifest = JSON.parse(await readFile(new URL("../public/manifest.json", import.meta.url), "utf8"));
const baseline = JSON.parse(await readFile(new URL("../public/rules/baseline.json", import.meta.url), "utf8"));

test("manifest keeps URL subscriptions and ships only a small audited baseline", () => {
  assert.ok(manifest.permissions.includes("declarativeNetRequest"));
  assert.equal(manifest.declarative_net_request.rule_resources[0].path, "rules/baseline.json");
  assert.deepEqual(manifest.content_scripts[0].matches.sort(), ["http://*/*", "https://*/*"]);
  assert.equal(manifest.content_scripts[0].js[0], "content/cosmetic-content.js");
  assert.equal(manifest.minimum_chrome_version, "121");
  assert.ok(manifest.host_permissions.includes("https://easylist-downloads.adblockplus.org/*"));
  assert.equal(manifest.host_permissions.includes("<all_urls>"), false);
});

test("baseline covers d3ward host categories without a broad third-party catch-all", () => {
  assert.equal(baseline.length, 26);
  const oemHosts = [
    "data.ads.oppomobile.com", "ck.ads.oppomobile.com", "adx.ads.oppomobile.com", "adsfs.oppomobile.com",
    "bdapi-ads.realmemobile.com", "bdapi-in-ads.realmemobile.com",
    "data.mistat.xiaomi.com", "data.mistat.rus.xiaomi.com", "data.mistat.india.xiaomi.com",
    "tracking.rus.miui.com", "grs.hicloud.com",
  ];
  for (const host of oemHosts) {
    const rule = baseline.find((candidate) => candidate.condition.urlFilter === `||${host}^`);
    assert.ok(rule, `missing OEM baseline rule for ${host}`);
    assert.equal(rule.condition.domainType, "thirdParty");
    assert.deepEqual(rule.condition.excludedInitiatorDomains, PROTECTED_INITIATOR_DOMAINS);
  }
  for (const path of ["ads.js", "pagead.js"]) {
    const rule = baseline.find((candidate) => candidate.condition.urlFilter === path);
    assert.deepEqual(rule.condition.initiatorDomains, ["d3ward.com", "d3ward.github.io"]);
    assert.deepEqual(rule.condition.resourceTypes, ["script"]);
  }
  for (const host of ["12ezo5v60.com", "ybs2ffs7v.com", "fvcwqkkqmuv.com"]) {
    const rule = baseline.find((candidate) => candidate.condition.urlFilter === `||${host}^`);
    assert.deepEqual(rule.condition.initiatorDomains, ["canyoublockit.com"]);
    assert.equal(rule.condition.domainType, "thirdParty");
    assert.deepEqual(rule.condition.excludedInitiatorDomains, PROTECTED_INITIATOR_DOMAINS);
  }
  const grouped = baseline.filter((candidate) => candidate.condition.requestDomains);
  assert.equal(grouped.length, 2);
  assert.equal(grouped.reduce((sum, rule) => sum + rule.condition.requestDomains.length, 0), 131);
  assert.ok(grouped.every((rule) => rule.condition.regexFilter === "^https?://"));
  assert.ok(grouped.every((rule) => rule.condition.domainType === "thirdParty"));
  for (const domain of [
    "adtago.s3.amazonaws.com", "pagead2.googlesyndication.com", "ads30.adcolony.com", "static.media.net",
    "analytics.google.com", "events.hotjar.io", "cdn.mouseflow.com", "freshmarketer.com", "stats.wp.com",
    "notify.bugsnag.com", "browser.sentry-cdn.com", "pixel.facebook.com", "ads-api.twitter.com",
    "ads.linkedin.com", "ads.pinterest.com", "events.reddit.com", "ads.youtube.com", "ads-api.tiktok.com",
    "ads.yahoo.com", "metrika.yandex.ru", "auction.unityads.unity3d.com", "api.ad.xiaomi.com",
    "metrics.data.hicloud.com", "click.oneplus.cn", "samsungads.com", "iadsdk.apple.com",
  ]) assert.ok(grouped.some((rule) => rule.condition.requestDomains.includes(domain)), `missing d3ward host ${domain}`);
  assert.ok(grouped.every((rule) => rule.condition.requestDomains.length <= 100));
});

test("conversion preserves exceptions, exclusions, types and case without broadening unsupported syntax", () => {
  const {rules} = convertFilterList(`[Adblock Plus 2.0]
||ads.example^
@@||ads.example/needed.js$script,domain=site.example|~private.site.example
||other.example^$~image,~third-party,match-case
site.example#$#abort-on-property-read ad
site.example#?#div:-abp-has(.ad)
site.example##.ad
/ads[0-9]+/$script
||skip.example^$redirect=noopjs
||skip.example^$document
||*.invalid/*$script
||disabled.example^$script
||disabled.example^$script,badfilter`);
  assert.equal(rules.length, 4);
  const exception = rules.find(rule => rule.action.type === "allow");
  assert.deepEqual(exception.condition.resourceTypes, ["script"]);
  assert.deepEqual(exception.condition.initiatorDomains, ["site.example"]);
  assert.ok(exception.condition.excludedInitiatorDomains.includes("private.site.example"));
  const negative = rules.find(rule => rule.condition.urlFilter.includes("other"));
  assert.equal(negative.condition.domainType, "firstParty");
  assert.equal(negative.condition.isUrlFilterCaseSensitive, true);
  assert.equal(negative.condition.resourceTypes.includes("image"), false);
});

test("always-on reconciliation migrates disabled state, preserves unrelated rules, and retries failures", async () => {
  const result = await build({ entryPoints: ["src/background/blocking/blocker.ts"], bundle: true, format: "esm", platform: "node", write: false });
  const blocker = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
  const previous = globalThis.chrome;
  let dynamic = [
    { id: 1_000_001, action: { type: "allowAllRequests" } },
    { id: 7, action: { type: "block" } },
  ];
  let fail = true, removedKeys = [], alarm;
  globalThis.chrome = {
    alarms: { async create(name, options) { alarm = { name, ...options }; } },
    storage: { local: { async remove(keys) { removedKeys = keys; }, async get() { return {}; } } },
    declarativeNetRequest: {
      async getDynamicRules() { return dynamic; },
      async updateDynamicRules({removeRuleIds}) { if (fail) { fail = false; throw Error("transient"); } dynamic = dynamic.filter(rule => !removeRuleIds.includes(rule.id)); },
    },
  };
  try {
    await assert.rejects(blocker.initializeBlocking(), /transient/);
    assert.equal(alarm.periodInMinutes, 1);
    assert.deepEqual(removedKeys, []);
    await Promise.all([blocker.initializeBlocking(), blocker.initializeBlocking()]);
    assert.equal((await blocker.getBlockingStatus()).enabled, true);
    assert.equal((await blocker.getBlockingStatus()).ready, false);
    assert.deepEqual(dynamic, [{ id: 7, action: { type: "block" } }]);
    assert.deepEqual(removedKeys, ["unipass_blocking_enabled", "unipass_blocking_whitelist"]);
    await blocker.initializeBlocking();
  } finally { globalThis.chrome = previous; }
});

test("settings and message contract expose only explicit site pause/resume", async () => {
  const html = await readFile(new URL("../src/popup/popup.html", import.meta.url), "utf8");
  const popupCss = await readFile(new URL("../src/popup/popup.css", import.meta.url), "utf8");
  const contract = await readFile(new URL("../src/shared/types.ts", import.meta.url), "utf8");
  const worker = await readFile(new URL("../src/background/service-worker.ts", import.meta.url), "utf8");
  assert.match(html, /id="pageHostControl"[^>]*class="host-chip"/);
  assert.doesNotMatch(html, /id="blockingControls"/);
  assert.match(html, /title="正在识别当前页面"/);
  assert.match(popupCss, /.host-chip > span:last-child[\s\S]*line-height: normal;/);
  assert.match(contract + worker, /pauseBlockingForSite/);
  assert.match(contract + worker, /resumeBlockingForSite/);
  assert.doesNotMatch(contract + worker, /setBlockingEnabled|setBlockingSiteAllowed|clearBlockingWhitelist/);
  assert.match(worker, /alarm.name === BLOCKING_RECONCILE_ALARM/);
});
