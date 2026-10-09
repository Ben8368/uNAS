import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const popupSource = await readFile(new URL("../src/popup/credentials.ts", import.meta.url), "utf8");
const catalogSource = await readFile(new URL("../src/popup/catalog.ts", import.meta.url), "utf8");
const workerSource = await readFile(new URL("../src/background/service-worker.ts", import.meta.url), "utf8");
const overlaySource = await readFile(new URL("../src/background/page-overlay.ts", import.meta.url), "utf8");
const contentOverlaySource = await readFile(new URL("../src/content/page-overlay.ts", import.meta.url), "utf8");
const settingsSource = await readFile(new URL("../src/popup/settings.ts", import.meta.url), "utf8");
const webdavSettingsSource = await readFile(new URL("../src/popup/webdav-settings.ts", import.meta.url), "utf8");
const currentPageAccountSource = await readFile(new URL("../src/popup/current-page-account.ts", import.meta.url), "utf8");
const importSource = await readFile(new URL("../src/popup/import-passwords.ts", import.meta.url), "utf8");
const cacheSource = await readFile(new URL("../src/background/vault/local-cache.ts", import.meta.url), "utf8");

test("Popup delegates credential filling to the Service Worker", () => {
  assert.match(popupSource, /type: "fillFromPopup"/);
  assert.doesNotMatch(popupSource, /fallbackUsername/);
  assert.doesNotMatch(popupSource, /response\.password/);
  assert.doesNotMatch(popupSource, /chrome\.scripting\.executeScript/);
  assert.match(workerSource, /case "fillFromPopup":\s+return requiresUniPassScope\(message\) \? withUserScope\(message\.userScope \?\? "", \(\) => fillFromPopup\(message\)\) : fillFromPopup\(message\)/);
  assert.match(workerSource, /function requiresUniPassScope[\s\S]*?message\.accountRef\.vaultId === "legacy-unipass"/);
  assert.match(overlaySource, /export async function fillFromPopup/);
  assert.match(overlaySource, /credential = await credentialForAccount\(message\.accountId\)/);
});

test("Service Worker rechecks the user scope before filling a credential", () => {
  assert.match(overlaySource, /import \{ assertCurrentUserScope \} from "\.\/user-scope-guard"/);
  assert.match(
    overlaySource,
    /credential = await credentialForAccount\([\s\S]*?if \(requiresScope\) await assertCurrentUserScope\(message\.userScope \?\? ""\)[\s\S]*?executeScript/,
  );
  assert.match(
    overlaySource,
    /if \(!injection\?\.documentId\)[\s\S]*?if \(requiresScope\) await assertCurrentUserScope\(message\.userScope \?\? ""\)[\s\S]*?sendMessage/,
  );
});

test("Reveal is available through the WebDAV account-details path", () => {
  assert.match(workerSource, /case "revealCredential":/);
  assert.match(workerSource, /assertRevealSource\(sender, message\.accountRef\)/);
  assert.doesNotMatch(workerSource, /case "credential":/);
});

test("Popup reveal has no system verification dependency and uses five clicks", () => {
  assert.doesNotMatch(settingsSource, /enableAdvancedMode|authenticateSystemAuthenticator|ADVANCED_MODE_PORT_NAME/);
  assert.doesNotMatch(workerSource, /advancedCapabilities|system-auth|enableAdvancedMode/);
  assert.match(catalogSource, /连续点击 5 次查看账号/);
  assert.match(catalogSource, /clicks >= 5/);
  assert.match(catalogSource, /allowReveal && this\.allowPasswordReveal && ref\.vaultId !== "legacy-unipass"/);
  assert.match(settingsSource, /dispose\(\): void/);
});

test("WebDAV applications can load without a UniPass session", () => {
  assert.match(catalogSource, /type: "listApps", keyword, userScope: this\.userScope \?\? ""/);
  assert.match(catalogSource, /const keepalive = this\.userScope/);
  assert.match(catalogSource, /type: "accountsForApp", appId: app\.id, vaultId: app\.vaultId, userScope: this\.userScope \?\? ""/);
});

test("settings connects WebDAV inside the extension UI without opening a management tab", () => {
  assert.match(settingsSource, /new WebDavSettingsController\(reportStatus/);
  assert.doesNotMatch(settingsSource, /openVaultManager|chrome\.tabs\.create/);
  assert.doesNotMatch(webdavSettingsSource, /requestWebDavPermission|chrome\.permissions/);
  assert.match(webdavSettingsSource, /type: "testWebDavConnection"/);
  assert.match(webdavSettingsSource, /type: "saveWebDavVault"/);
  assert.match(webdavSettingsSource, /type: "removeVault"/);
  assert.match(workerSource, /sender\.id !== chrome\.runtime\.id/);
  assert.match(workerSource, /case "testWebDavConnection":[\s\S]*requestWebDavPermission/);
  assert.match(workerSource, /case "removeVault":\s+return requireVaultManager\(sender, \(\) => removeVault\(message\.vaultId\)\)/);
  assert.doesNotMatch(workerSource, /case "openVaultManager"/);
});

test("browser CSV import stays user-triggered, masked in preview, and clears plaintext references", () => {
  assert.match(importSource, /this\.input\.files\?\.\[0\]/);
  assert.match(importSource, /parseBrowserPasswordCsv/);
  assert.match(importSource, /this\.text\("••••••••"\)/);
  assert.match(importSource, /for \(const record of this\.records\) record\.password = ""/);
  assert.doesNotMatch(importSource, /chrome\.storage|indexedDB|fetch\(/);
  assert.match(workerSource, /case "previewBrowserPasswords"/);
  assert.match(workerSource, /case "importBrowserPasswords"/);
  assert.doesNotMatch(cacheSource, /password:|vaultKey:|appPassword:/);
});

test("page overlay keeps editable keystrokes inside the Shadow DOM", () => {
  assert.match(contentOverlaySource, /stopEditableKeyPropagation/);
  assert.match(contentOverlaySource, /target\.matches\("input, textarea, select"\) \|\| target\.isContentEditable/);
  assert.match(contentOverlaySource, /event\.stopPropagation\(\)/);
  assert.match(contentOverlaySource, /\["keydown", "keypress", "keyup"\]/);
  assert.doesNotMatch(contentOverlaySource, /stopEditableKeyPropagation[\s\S]*event\.preventDefault\(\)/);
});

test("an empty current page offers an inline WebDAV account form", () => {
  assert.match(catalogSource, /listVaultConnectionStates/);
  assert.match(catalogSource, /if \(!accounts\.length\) await this\.currentPageEditor\.render\(tab, catalog\.entries, connectionStates\)/);
  assert.match(currentPageAccountSource, /这个页面还没有保存账号/);
  assert.match(currentPageAccountSource, /type: "createVaultApp"/);
  assert.match(currentPageAccountSource, /type: "createVaultAccount"/);
  assert.match(currentPageAccountSource, /vaultTargetMatches\(target, url\)/);
});

test("a disconnected WebDAV Vault is routed to reconnect instead of an empty-account form", () => {
  assert.match(workerSource, /case "listVaultConnectionStates":\s+return requireVaultManager\(sender, listVaultConnectionStates\)/);
  assert.match(currentPageAccountSource, /账号仍在密码库中，需要重新连接/);
  assert.match(currentPageAccountSource, /重新连接 \$\{state\.name\}/);
  assert.match(currentPageAccountSource, /new CustomEvent\("unipass-open-webdav-settings", \{ detail: \{ vaultId: state\.vaultId \} \}\)/);
  assert.match(settingsSource, /event\.detail\?\.vaultId/);
  assert.match(webdavSettingsSource, /async open\(vaultId\?: string\)/);
});

test("a disconnected Vault does not masquerade as a UniPass application sync failure", () => {
  assert.match(catalogSource, /密码库 \$\{names\} 需要重新连接，账号目录未读取/);
  assert.match(catalogSource, /const reconnectFailures = result\.failures\.filter/);
  assert.match(catalogSource, /const otherFailures = result\.failures\.filter/);
  assert.match(catalogSource, /if \(!previous\) throw new Error\("账号目录同步未完成，请稍后重试"\)/);
  assert.doesNotMatch(catalogSource, /return previous \?\? \{ syncedAt: 0, entries: result\.entries \}/);
});

test("application icons require five clicks before opening account details", () => {
  assert.match(catalogSource, /root\.className = "item app-item"/);
  assert.match(catalogSource, /root\.append\(this\.appIcon\(title, app\), main, actions\)/);
  assert.match(catalogSource, /slot\.append\(icon\);\s+return slot/);
  assert.match(catalogSource, /let clicks = 0/);
  assert.match(catalogSource, /if \(clicks >= 5\)/);
  assert.match(catalogSource, /void this\.loadAppAccounts\(app\)/);
  assert.match(catalogSource, /const open = button\("打开页面"\);[\s\S]*?open\.addEventListener\("click", \(\) => void this\.openAppPage\(app\)\)/);
});

test("application cards use the background availability aggregate and explain filtered states", () => {
  assert.match(catalogSource, /send<AvailableAppsResult>\(\{ type: "listApps"/);
  assert.match(catalogSource, /normalizeAvailableAppsResult/);
  assert.match(catalogSource, /if \(Array\.isArray\(value\)\)/);
  assert.match(catalogSource, /应用列表返回格式异常，请重新加载扩展/);
  assert.match(catalogSource, /excludedEmptyCredentialApps/);
  assert.match(catalogSource, /excludedVerificationFailureApps/);
  assert.match(catalogSource, /excludedDirectoryFailureApps/);
  assert.match(catalogSource, /没有可用密码，已隐藏/);
  assert.match(catalogSource, /凭据暂时无法验证，已隐藏/);
  assert.match(catalogSource, /账号目录同步失败，已隐藏/);
});

test("current-page account cards never expose password viewing", () => {
  assert.match(catalogSource, /allowReveal = false/);
  assert.match(catalogSource, /if \(allowReveal && this\.allowPasswordReveal && ref\.vaultId !== "legacy-unipass"\)/);
});
