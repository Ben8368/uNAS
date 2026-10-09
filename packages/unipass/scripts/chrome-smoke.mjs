import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { createServer } from "node:http";
import { access, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import puppeteer from "puppeteer-core";
import { build as buildEsbuild } from "esbuild";
import { inspectHardenedMetadata } from "./release-artifact-check.mjs";
import { assertLiveBlockingCoverage } from "./blocking-coverage-smoke.mjs";

const root = resolve(import.meta.dirname, "..");
const execFile = promisify(execFileCallback);
const smokeArguments = process.argv.slice(2);
const hardened = smokeArguments.includes("--hardened");
const distArgument = smokeArguments.find((argument) => argument !== "--hardened");
const dist = resolve(root, distArgument ?? process.env.CHROME_SMOKE_DIST ?? "dist");

if (hardened) {
  const metadataErrors = await inspectHardenedMetadata(resolve(root, "artifacts/hardened"), dist);
  if (metadataErrors.length) {
    throw new Error(`Hardened Chrome smoke requires a verified hardened dist:\n${metadataErrors.join("\n")}`);
  }
}

const manifest = JSON.parse(await readFile(join(dist, "manifest.json"), "utf8"));
const chromePath = await findChrome();
const userDataDir = join(tmpdir(), `unipass-chrome-smoke-${process.pid}-${Date.now()}`);
const dnrFixture = await startDnrFixture();

try {
  let browser = await launchExtension(chromePath, dist, userDataDir);
  const errors = [];
  try {
    const serviceWorkerTarget = await waitForTarget(browser, (target) =>
      target.type() === "service_worker" && target.url().endsWith("/background/service-worker.js"));
    const extensionId = new URL(serviceWorkerTarget.url()).hostname;
    assert.match(extensionId, /^[a-p]{32}$/);

    let popup = await browser.newPage();
    attachPageErrors(popup, errors);
    await gotoExtensionPage(popup, `chrome-extension://${extensionId}/popup.html`);
    assert.equal(await popup.title(), "UniPass");
    const loadedManifest = await popup.evaluate(async () => {
      const response = await fetch(chrome.runtime.getURL("manifest.json"));
      return response.json();
    });
    assert.equal(loadedManifest.manifest_version, 3);
    assert.equal(loadedManifest.name, manifest.name);

    await assertWasmLoads(await waitForWorker(serviceWorkerTarget));
    const dnrResult = await assertDnrSmoke(browser, popup, dnrFixture.url, extensionId);
    browser = dnrResult.browser;
    popup = dnrResult.popup;

    if (process.env.CHROME_SMOKE_SKIP_RESTART !== "true") {
      assert.equal(await popup.evaluate(() => typeof chrome.runtime.reload), "function");
      await popup.evaluate(() => {
        setTimeout(() => chrome.runtime.reload(), 0);
        return true;
      });

      // runtime.reload() may reuse the Service Worker target object. Wait for the
      // old popup to close before opening the extension page again, then resolve the
      // current worker by URL instead of requiring a new target identity.
      await waitForPageClosed(popup);
      const restartedTarget = await waitForTarget(browser, (target) =>
        target.type() === "service_worker" && target.url().endsWith("/background/service-worker.js"), { timeout: 15_000 });
      // Chrome 152 keeps the dynamically installed extension page blocked after
      // runtime.reload(), and Puppeteer can retain a stale worker target whose
      // evaluate() never resolves. The target reappearance is the restart
      // assertion here; WASM initialization is covered on first load and in the
      // a fresh first-load smoke run.
      assert.equal(restartedTarget.type(), "service_worker");
    }

    assert.deepEqual(errors, [], `extension console errors:\n${errors.join("\n")}`);
    const restartLabel = process.env.CHROME_SMOKE_SKIP_RESTART === "true" ? "restart skipped for this runner" : "restart verified";
    console.log(`Chrome smoke GREEN: Google Chrome, MV3 manifest, popup, Service Worker, WASM and ${restartLabel}`);
  } finally {
    await browser.close();
  }
} finally {
  await rm(userDataDir, { recursive: true, force: true });
  await dnrFixture.close();
}


async function assertDnrSmoke(browser, extensionPage, fixtureUrl, extensionId) {
  let page = await browser.newPage();
  let controlPage = extensionPage;
  let activeBrowser = browser;
  try {
    await awaitSubscriptionsAndInstallFixture(controlPage);
    await page.goto(fixtureUrl, { waitUntil: "domcontentloaded" });
    await assertVaultCacheTransactionSmoke(page);
    await installCosmeticFixture(controlPage);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".unipass-cosmetic-fixture")).display === "none");
    assert.notEqual(await page.$eval(".unipass-cosmetic-exception-fixture", (element) => getComputedStyle(element).display), "none", "site cosmetic exception must override a global selector in generated CSS");
    assert.equal(await page.$eval(".unipass-scriptlet-fixture", (element) => element.hasAttribute("data-ad")), false, "local remove-attr scriptlet must run");
    assert.equal(await page.$eval(".unipass-scriptlet-fixture", (element) => element.hasAttribute("data-track")), false, "one bounded observer must apply each audited remove-attr operation");
    await page.$eval(".unipass-scriptlet-fixture", (element) => {
      element.setAttribute("data-ad", "restored");
      element.setAttribute("data-track", "restored");
    });
    await page.waitForFunction(() => !document.querySelector(".unipass-scriptlet-fixture")?.hasAttribute("data-ad") && !document.querySelector(".unipass-scriptlet-fixture")?.hasAttribute("data-track"));
    await assertLiveBlockingCoverage(page, controlPage);
    const blockedUrl = `${fixtureUrl}unipass-dnr-smoke-blocked`;
    const request = () => page.evaluate(async (url) => {
      try {
        const response = await fetch(url, { cache: "no-store" });
        return { ok: true, status: response.status };
      } catch (error) {
        return { ok: false, name: error instanceof Error ? error.name : "unknown" };
      }
    }, blockedUrl);

    const thirdPartyBlockedUrl = blockedUrl.replace("127.0.0.1", "localhost");
    const thirdPartyRequest = () => page.evaluate(async (url) => {
      try { await fetch(url, { mode: "no-cors", cache: "no-store" }); return true; }
      catch { return false; }
    }, thirdPartyBlockedUrl);

    assert.equal((await request()).ok, false, "enabled blocker must block the local tracker fixture");
    assert.equal(await thirdPartyRequest(), false, "enabled blocker must block a third-party fixture request");
    const rejected = await controlPage.evaluate(async () => Promise.all([
      chrome.runtime.sendMessage({ type: "setBlockingEnabled", enabled: false }),
      chrome.runtime.sendMessage({ type: "setBlockingSiteAllowed", host: "127.0.0.1", allowed: true }),
    ]));
    assert.ok(rejected.every(response => response?.ok === false), "legacy disable messages must be rejected");
    const staticRulesets = await controlPage.evaluate(async () => chrome.declarativeNetRequest.getEnabledRulesets());
    assert.ok(staticRulesets.includes("baseline"), "offline baseline ruleset must stay enabled");
    await page.bringToFront();
    const fixtureTabId = await controlPage.evaluate(async (url) => (await chrome.tabs.query({})).find((tab) => tab.url === url)?.id, fixtureUrl);
    assert.ok(fixtureTabId != null, "fixture tab must be addressable for site pause smoke");
    const paused = await controlPage.evaluate(async (tabId) => chrome.runtime.sendMessage({ type: "pauseBlockingForSite", tabId }), fixtureTabId);
    assert.equal(paused.ok, true, JSON.stringify(paused));
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".unipass-cosmetic-fixture")).display !== "none");
    await page.waitForFunction(() => document.querySelector(".unipass-scriptlet-fixture")?.hasAttribute("data-ad") && document.querySelector(".unipass-scriptlet-fixture")?.hasAttribute("data-track"));
    assert.equal(await thirdPartyRequest(), true, "pause must allow third-party requests from an already open page");
    const resumed = await controlPage.evaluate(async (tabId) => chrome.runtime.sendMessage({ type: "resumeBlockingForSite", tabId }), fixtureTabId);
    assert.equal(resumed.ok, true, JSON.stringify(resumed));
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".unipass-cosmetic-fixture")).display === "none");
    await page.waitForFunction(() => !document.querySelector(".unipass-scriptlet-fixture")?.hasAttribute("data-ad") && !document.querySelector(".unipass-scriptlet-fixture")?.hasAttribute("data-track"));
    assert.equal(await thirdPartyRequest(), false, "resume must restore third-party blocking without reloading");
    const expiring = await controlPage.evaluate(async (tabId) => chrome.runtime.sendMessage({ type: "pauseBlockingForSite", tabId }), fixtureTabId);
    assert.equal(expiring.ok, true, JSON.stringify(expiring));
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".unipass-cosmetic-fixture")).display !== "none");
    await controlPage.evaluate(async () => {
      await chrome.storage.local.set({ unipass_blocking_paused_sites: [{ host: "127.0.0.1", expiresAt: Date.now() - 1 }] });
      await chrome.runtime.sendMessage({ type: "getBlockingStatus" });
    });
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".unipass-cosmetic-fixture")).display === "none");
    assert.equal(await thirdPartyRequest(), false, "expiry must restore blocking without reloading");
    // Seed the previous release's disabled state to exercise upgrade migration.
    await controlPage.evaluate(async () => {
      await chrome.storage.local.set({ unipass_blocking_enabled: false, unipass_blocking_whitelist: ["127.0.0.1"] });
      await chrome.declarativeNetRequest.updateDynamicRules({ addRules: [{
         id: 1_000_001, priority: 1000, action: { type: "allowAllRequests" },
        condition: { urlFilter: "|http://127.0.0.1^", resourceTypes: ["main_frame", "sub_frame"] },
      }] });
    });

    // CDP loadUnpacked is temporary: closing Chrome and installing again clears
    // dynamic rules. This checks fresh subscription recovery, not offline browser persistence.
    await activeBrowser.close();
    activeBrowser = await launchExtension(chromePath, dist, userDataDir);
    controlPage = await activeBrowser.newPage();
    await gotoExtensionPage(controlPage, `chrome-extension://${extensionId}/popup.html`);
    await awaitSubscriptionsAndInstallFixture(controlPage);
    page = await activeBrowser.newPage();
    await page.goto(fixtureUrl, { waitUntil: "domcontentloaded" });
    const persisted = await controlPage.evaluate(async () => chrome.runtime.sendMessage({ type: "getBlockingStatus" }));
    assert.equal(persisted?.ok, true);
    assert.equal(persisted.data.enabled, true, "always-on blocker must recover after temporary reinstall");
    assert.equal(persisted.data.ready, true);
    assert.ok(persisted.data.ruleCount > 1000, "temporary reinstall must recover live subscriptions");
    const migrated = await controlPage.evaluate(async () => ({
      settings: await chrome.storage.local.get(["unipass_blocking_enabled", "unipass_blocking_whitelist"]),
      rules: await chrome.declarativeNetRequest.getDynamicRules(),
    }));
    assert.deepEqual(migrated.settings, {});
    assert.equal(migrated.rules.some(rule => rule.id === 1_000_001), false);
    await page.reload({ waitUntil: "domcontentloaded" });
    assert.equal((await request()).ok, false, "restart must restore blocking despite legacy disabled settings");
    const ordinary = await page.evaluate(async url => (await fetch(url)).status, fixtureUrl);
    assert.equal(ordinary, 200, "ordinary requests must still work");
    // Stop the actual worker and close UI: DNR must continue without either.
    const cdp = await page.createCDPSession();
    await cdp.send("ServiceWorker.enable");
    await cdp.send("ServiceWorker.stopAllWorkers");
    await controlPage.close();
    assert.equal((await request()).ok, false, "DNR must block while worker and popup are closed");
    await cdp.detach();
    controlPage = await activeBrowser.newPage();
    await gotoExtensionPage(controlPage, `chrome-extension://${extensionId}/popup.html`);
    const cached = await controlPage.evaluate(async () => chrome.runtime.sendMessage({ type: "getBlockingStatus" }));
    assert.equal(cached.data.ruleCount, persisted.data.ruleCount, "worker restart must retain downloaded rules");
    console.log("Chrome blocking smoke GREEN: baseline, live subscriptions, cosmetic/scriptlet, explicit pause/resume, migration, temporary reinstall recovery, worker-stopped blocking and cached rules");
  } catch (error) {
    if (activeBrowser !== browser) await activeBrowser.close().catch(() => {});
    throw error;
  } finally {
    if (!controlPage.isClosed()) await controlPage.evaluate(async () => chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [999_999] })).catch(() => {});
    if (!page.isClosed()) await page.close();
  }
  return { browser: activeBrowser, popup: controlPage };
}

async function assertVaultCacheTransactionSmoke(page) {
  const bundled = await buildEsbuild({
    entryPoints: [join(root, "src/background/vault/local-cache.ts")],
    bundle: true, platform: "browser", format: "iife", globalName: "UniPassVaultCacheSmoke", write: false,
  });
  await page.addScriptTag({ content: bundled.outputFiles[0].text });
  const result = await page.evaluate(async () => {
    const cache = new globalThis.UniPassVaultCacheSmoke.EncryptedVaultCache(`smoke-${crypto.randomUUID()}`);
    const id = "app_1234567890123456";
    const initial = await cache.put(id, new Uint8Array([0]));
    const writes = await Promise.allSettled([
      cache.put(id, new Uint8Array([1]), initial.revision),
      cache.put(id, new Uint8Array([2]), initial.revision),
    ]);
    const final = await cache.record(id);
    await cache.clear();
    return { statuses: writes.map((write) => write.status).sort(), final: [...final.data] };
  });
  assert.deepEqual(result.statuses, ["fulfilled", "rejected"], "IndexedDB must reject one stale concurrent write");
  assert.ok(result.final[0] === 1 || result.final[0] === 2);
  console.log("Chrome Vault cache transaction smoke GREEN: stale concurrent write rejected by IndexedDB");
}

async function awaitSubscriptionsAndInstallFixture(controlPage) {
    await controlPage.waitForFunction(async () => {
      const response = await chrome.runtime.sendMessage({ type: "getBlockingStatus" });
      return response?.ok && response.data.ready && response.data.ruleCount > 1000;
    }, { timeout: 60_000, polling: 500 }).catch(async error => {
      const status = await controlPage.evaluate(async () => chrome.runtime.sendMessage({ type: "getBlockingStatus" }));
      throw new Error(`Live subscription never became ready: ${JSON.stringify(status)}`, { cause: error });
    });
    const subscriptionState = await controlPage.evaluate(async () => chrome.runtime.sendMessage({ type: "getBlockingStatus" }));
    console.log(`Live subscription update GREEN: ${subscriptionState.data.ruleCount} dynamic rules`);
    // Local fixture is injected only by this test, never shipped in the extension.
    await controlPage.evaluate(async () => chrome.declarativeNetRequest.updateDynamicRules({ addRules: [{
      id: 999_999, priority: 1, action: { type: "block" },
      condition: { urlFilter: "/unipass-dnr-smoke-blocked", initiatorDomains: ["127.0.0.1"], resourceTypes: ["xmlhttprequest"] },
    }] }));
}

async function installCosmeticFixture(controlPage) {
  await controlPage.evaluate(async () => chrome.storage.local.set({ unipass_cosmetic_store: {
    version: 2, generation: 3,
    globalSelectors: [".unipass-cosmetic-fixture", ".unipass-cosmetic-exception-fixture"],
    globalScriptlets: [
      { id: "remove-attr:.unipass-scriptlet-fixture:data-ad", name: "remove-attr", args: [".unipass-scriptlet-fixture", "data-ad"] },
      { id: "remove-attr:.unipass-scriptlet-fixture:data-track", name: "remove-attr", args: [".unipass-scriptlet-fixture", "data-track"] },
    ],
    globalSelectorExceptions: [], globalScriptletExceptions: [],
    sites: [{ hosts: ["127.0.0.1"], excludedHosts: [], selectors: [], scriptlets: [], selectorExceptions: [".unipass-cosmetic-exception-fixture"], scriptletExceptions: [] }],
    report: { inputRules: 1, selectors: 1, scriptlets: 1, skipped: 0, invalid: 0, exceptions: 0, truncated: 0, scriptletSkipped: 0 },
  } }));
}

async function startDnrFixture() {
  const server = createServer((request, response) => {
    if (request.url === "/") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end("<!doctype html><title>DNR smoke</title><div class=unipass-cosmetic-fixture>fixture ad</div><div class=unipass-cosmetic-exception-fixture>fixture exception</div><div class=unipass-scriptlet-fixture data-ad=1 data-track=1>fixture attr</div><p>fixture</p>");
      return;
    }
    if (request.url === "/unipass-dnr-smoke-blocked") {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("fixture request reached the server");
      return;
    }
    response.writeHead(404);
    response.end();
  });
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    await new Promise((resolvePromise) => server.close(resolvePromise));
    throw new Error("无法启动 Chrome DNR smoke 本地 fixture");
  }
  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: () => new Promise((resolvePromise) => server.close(resolvePromise)),
  };
}


function attachPageErrors(page, errors) {
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`popup console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`popup page error: ${error.message}`));
}


async function launchExtension(chromePath, extensionDirectory, userDataDirectory) {
  return puppeteer.launch({
    executablePath: chromePath,
    headless: process.env.CHROME_SMOKE_HEADLESS === "true" ? "new" : false,
    enableExtensions: [extensionDirectory],
    pipe: true,
    userDataDir: userDataDirectory,
    defaultViewport: { width: 1280, height: 900 },
    args: [
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-popup-blocking",
      ...(process.env.CHROME_SMOKE_NO_SANDBOX === "true" ? ["--no-sandbox"] : []),
    ],
  });
}


async function assertWasmLoads(worker) {
  const result = await worker.evaluate(async () => {
    const response = await fetch(chrome.runtime.getURL("credential-core.wasm"), { cache: "no-store" });
    if (!response.ok) throw new Error(`WASM fetch HTTP ${response.status}`);
    const bytes = await response.arrayBuffer();
    const module = await WebAssembly.compile(bytes);
    await WebAssembly.instantiate(module, {});
    return {
      imports: WebAssembly.Module.imports(module).length,
      exports: WebAssembly.Module.exports(module).map(({ name }) => name).sort(),
    };
  });
  assert.equal(result.imports, 0);
  assert.deepEqual(result.exports, ["c_a", "c_f", "c_k", "c_u", "c_v", "memory"]);
}

async function waitForWorker(target) {
  const worker = target.worker();
  if (!worker) throw new Error(`无法获取 Service Worker：${target.url()}`);
  return worker;
}

async function waitForTarget(browserInstance, predicate, { timeout = 10_000 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const target = browserInstance.targets().find(predicate);
    if (target) return target;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error("等待 Chrome 扩展目标超时");
}

async function waitForPageClosed(page, { timeout = 15_000 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (page.isClosed()) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error("等待扩展 popup 关闭超时");
}

async function gotoExtensionPage(page, url, { timeout = 15_000 } = {}) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      return await page.goto(url, { waitUntil: "domcontentloaded" });
    } catch (error) {
      lastError = error;
      if (!String(error?.message ?? error).includes("ERR_BLOCKED_BY_CLIENT")) throw error;
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
    }
  }
  throw lastError ?? new Error(`扩展页面加载超时：${url}`);
}

async function findChrome() {
  const candidates = [process.env.CHROME_BIN, process.env.CHROME_PATH].filter(Boolean);
  for (const candidate of candidates) {
    const resolvedCandidate = await existingExecutable(candidate);
    if (resolvedCandidate) return resolvedCandidate;
  }

  const commandNames = process.platform === "win32"
    ? ["chrome.exe"]
    : process.platform === "darwin"
      ? ["google-chrome", "chrome"]
      : ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome"];
  for (const commandName of commandNames) {
    const commandPath = await resolveCommand(commandName);
    if (commandPath) return commandPath;
  }

  if (process.platform === "win32") {
    const registryPath = await findChromeFromWindowsRegistry();
    if (registryPath) return registryPath;
  }
  if (process.platform === "darwin") {
    const appPath = await findChromeFromMacOSMetadata();
    if (appPath) return appPath;
  }

  throw new Error("找不到 Google Chrome；请将 Google Chrome 加入 PATH，或通过 CHROME_BIN/CHROME_PATH 指定");
}

async function existingExecutable(candidate) {
  try {
    await access(candidate);
    return candidate;
  } catch {
    return null;
  }
}

async function resolveCommand(commandName) {
  const resolver = process.platform === "win32" ? "where.exe" : "which";
  try {
    const { stdout } = await execFile(resolver, [commandName], { windowsHide: true });
    const commandPath = stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
    return commandPath ? await existingExecutable(commandPath) : null;
  } catch {
    return null;
  }
}

async function findChromeFromWindowsRegistry() {
  const registryKeys = [
    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe",
    "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe",
    "HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe",
  ];
  for (const key of registryKeys) {
    try {
      const { stdout } = await execFile("reg.exe", ["query", key, "/ve"], { windowsHide: true });
      const match = stdout.match(/\sREG_SZ\s+(.+)\s*$/im);
      const executable = match?.[1]?.trim();
      const resolvedExecutable = executable ? await existingExecutable(executable) : null;
      if (resolvedExecutable) return resolvedExecutable;
    } catch {
      // Try the next standard Chrome registration location.
    }
  }
  return null;
}

async function findChromeFromMacOSMetadata() {
  try {
    const { stdout } = await execFile("mdfind", ["kMDItemCFBundleIdentifier == 'com.google.Chrome'"]);
    for (const appPath of stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)) {
      const executable = join(appPath, "Contents", "MacOS", "Google Chrome");
      const resolvedExecutable = await existingExecutable(executable);
      if (resolvedExecutable) return resolvedExecutable;
    }
  } catch {
    // Fall through to the platform-independent error message.
  }
  return null;
}
