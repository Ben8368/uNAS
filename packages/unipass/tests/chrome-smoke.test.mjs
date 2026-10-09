import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../scripts/chrome-smoke.mjs", import.meta.url), "utf8");

test("Chrome smoke uses Puppeteer's extension loader and platform discovery", () => {
  assert.match(source, /enableExtensions:\s*\[extensionDirectory\]/);
  assert.match(source, /pipe:\s*true/);
  assert.doesNotMatch(source, /Microsoft\\?\\?Edge|msedge/i);
  assert.equal(source.includes("Program Files"), false);
  assert.equal(source.includes("Applications/Google Chrome"), false);
  assert.equal(source.includes("/usr/bin/google-chrome"), false);
  assert.match(source, /CHROME_BIN/);
  assert.match(source, /findChromeFromWindowsRegistry/);
});

test("Chrome smoke no longer exercises an in-popup self-build flow", () => {
  assert.doesNotMatch(source, /SelfBuild|self-build|derivedBuild|triggerSelfBuildCompatibilityGesture/i);
});

test("Chrome smoke has no system authenticator verification path", () => {
  assert.doesNotMatch(source, /system-auth|beginSystemAuthenticator|credentials\.(create|get)/);
});

test("Chrome smoke exercises real DNR and cosmetic behavior with a local fixture", () => {
  assert.match(source, /async function assertDnrSmoke\(browser, extensionPage, fixtureUrl, extensionId\)/);
  assert.match(source, /setBlockingEnabled/, "legacy disable must be rejected");
  assert.match(source, /pauseBlockingForSite/, "site pause must be explicit");
  assert.match(source, /remove-attr/, "local scriptlet must be exercised");
  assert.match(source, /baseline/, "static baseline must be checked");
  assert.match(source, /always-on blocker must recover after temporary reinstall/);
  assert.match(source, /await page\.reload\(\{ waitUntil: "domcontentloaded" \}\)/);
  assert.match(source, /createServer/);
  assert.match(source, /unipass-dnr-smoke-blocked/);
  assert.doesNotMatch(source, /getMatchedRules|onRuleMatchedDebug/);
});
