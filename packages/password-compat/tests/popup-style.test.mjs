import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { formatBuildTime } from "../build.mjs";

const liquidGlassCss = await readFile(new URL("../src/popup/liquid-glass.css", import.meta.url), "utf8");
const componentsCss = await readFile(new URL("../src/popup/components.css", import.meta.url), "utf8");
const popupHtml = await readFile(new URL("../src/popup/popup.html", import.meta.url), "utf8");
const popupSource = await readFile(new URL("../src/popup/popup.ts", import.meta.url), "utf8");
const settingsSource = await readFile(new URL("../src/popup/settings.ts", import.meta.url), "utf8");
const webdavSettingsSource = await readFile(new URL("../src/popup/webdav-settings.ts", import.meta.url), "utf8");
const currentPageAccountSource = await readFile(new URL("../src/popup/current-page-account.ts", import.meta.url), "utf8");

test("build time uses the compact YYMMDD-HHMM format", () => {
  assert.equal(formatBuildTime(new Date(2026, 8, 10, 21, 12)), "260910-2112");
});

test("version settings places the build time beside the local version", () => {
  assert.match(popupHtml, /id="localBuildPluginVersion"[^>]*>检查中<\/strong><span id="localBuildTime"/);
});

test("WebDAV actions keep their positions while hiding build settings", () => {
  assert.match(popupHtml, /id="legacyBuildSettings" hidden[^>]*aria-hidden="true"/);
  assert.match(popupHtml, /id="versionSave"[^>]*>保存设置<\/button>/);
  assert.match(popupHtml, /id="restorePluginVersionBaseline"[^>]*disabled[^>]*>恢复默认<\/button>/);
  assert.doesNotMatch(popupHtml, /selfBuild|生成升级包|生成构建物/);
  assert.doesNotMatch(settingsSource, /SelfBuild|saveGesture|三击/);
  assert.match(settingsSource, /this\.restoreBaseline\.textContent = "恢复默认"/);
});

test("WebDAV settings keep connection actions inside the secondary panel", () => {
  assert.match(
    popupHtml,
    /id="webdavVaultName"[\s\S]*id="webdavUrl"[\s\S]*id="webdavUsername"[\s\S]*id="webdavPassword"/s,
  );
  assert.match(popupHtml, /class="webdav-auth-row"[\s\S]*id="webdavUsername"[\s\S]*id="webdavPassword"/s);
  assert.match(popupHtml, /id="webdavVaultKeyField"[\s\S]*<span>Vault Key<\/span>[\s\S]*id="webdavVaultKey"[\s\S]*id="webdavTaskHint"[^>]*>留空将新建密码库；粘贴已有 Vault Key 则接入远端密码库。/s);
  assert.match(popupHtml, /id="importBrowserPasswords" class="settings-secondary browser-import-trigger"[\s\S]*browser-import-trigger-icon[\s\S]*从浏览器导入密码[\s\S]*支持 Chrome \/ Edge CSV[\s\S]*browser-import-trigger-arrow/s);
  assert.match(popupHtml, /id="webdavVaultProfileField"[\s\S]*class="webdav-vault-split"[\s\S]*id="webdavVaultPicker"[\s\S]*id="webdavVaultSelection"[^>]*role="combobox"[\s\S]*class="webdav-vault-divider"[\s\S]*id="webdavUrl" type="url"/s);
  assert.match(popupHtml, /id="removeWebDavVault" class="webdav-vault-remove" type="button" title="删除密码库" aria-label="删除密码库" hidden>[\s\S]*m6 6 12 12M18 6 6 18/s);
  assert.match(popupHtml, /id="webdavActions"[\s\S]*id="testWebDav"[^>]*>仅测试<\/button>[\s\S]*id="saveWebDav"[^>]*>添加密码库<\/button>/s);
  assert.match(popupHtml, /id="webdavVaultProfileLabel">选择密码库[\s\S]*添加密码库/s);
  assert.doesNotMatch(popupHtml, /连接已有密码库|value="__existing__"/);
  assert.doesNotMatch(popupHtml, /<optgroup/);
  assert.doesNotMatch(popupHtml, /data-webdav-mode|id="webdavVaultMode"/);
  assert.doesNotMatch(popupHtml, /id="webdavLocalUnlock"|id="unlockWebDavAdvanced"/);
  assert.doesNotMatch(popupHtml, /id="setupWebDavSystemAuth"/);
  assert.doesNotMatch(popupHtml, /webdavLocalUnlockPassword|enableWebDavLocalUnlock|全局 PIN|备用 PIN/);
  assert.match(popupHtml, /id="webdavActions" class="settings-actions webdav-actions"/);
  assert.match(popupHtml, /<\/div>\s*<p id="webdavStatus" class="webdav-status" role="status" aria-live="polite" hidden><\/p>/s);
  assert.match(popupHtml, /id="webdavStatus" class="webdav-status" role="status" aria-live="polite" hidden/);
  assert.doesNotMatch(popupHtml, /id="openVaultManager"/);
  assert.match(
    componentsCss,
    /\.settings-actions > button\s*\{[^}]*height:\s*34px;[^}]*min-height:\s*34px;[^}]*align-items:\s*center;[^}]*justify-content:\s*center;[^}]*margin:\s*0;/s,
  );
  assert.doesNotMatch(componentsCss, /\.settings-save\s*\{[^}]*margin-top:\s*3px/s);
  assert.match(componentsCss, /\.settings-save\s*\{[^}]*min-width:\s*84px;[^}]*background:\s*var\(--green-strong\)/s);
  assert.match(componentsCss, /\.version-override select \{[^}]*color-scheme:\s*dark/s);
  assert.match(componentsCss, /\.version-override select option \{[^}]*background:\s*#0f151b;[^}]*color:\s*#f4f8fb/s);
  assert.match(componentsCss, /:root\[data-theme="light"\] \.version-override select \{[^}]*color-scheme:\s*light/s);
  assert.match(componentsCss, /:root\[data-theme="light"\] \.version-override select option \{[^}]*background:\s*#ffffff;[^}]*color:\s*#172536/s);
  assert.match(componentsCss, /\.webdav-auth-row\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\)/s);
});
test("current-page WebDAV empty state saves from the heading action", () => {
  assert.match(currentPageAccountSource, /current-page-add-heading/);
  assert.match(currentPageAccountSource, /current-page-add-icon/);
  assert.match(currentPageAccountSource, /WEB DAV/);
  assert.match(currentPageAccountSource, /button\("保存", "current-page-add-save"\)/);
  assert.doesNotMatch(currentPageAccountSource, /current-page-add-action/);
  assert.match(componentsCss, /\.current-page-add \{[^}]*background:\s*transparent/s);
  assert.match(componentsCss, /\.current-page-add-save \{[^}]*height:\s*30px;[^}]*min-height:\s*30px;[^}]*background:\s*rgba\(65, 211, 155, \.16\)/s);
  assert.match(componentsCss, /\.current-page-add-save:hover \{[^}]*background:\s*rgba\(65, 211, 155, \.26\)/s);
  assert.match(componentsCss, /\.current-page-add-icon svg/);
  assert.match(componentsCss, /\.current-page-add-destination/);
  assert.doesNotMatch(currentPageAccountSource, /直接添加到当前页面，之后即可一键填入/);
  assert.doesNotMatch(currentPageAccountSource, /button\("保存账号"/);
});

test("tab selection moves one shared indicator between views", () => {
  assert.match(popupHtml, /<span id="tabIndicator" class="tab-indicator" aria-hidden="true"><\/span>/);
  assert.match(popupSource, /get\("tabIndicator"\)\.classList\.toggle\("apps", view === "apps"\)/);
  assert.match(liquidGlassCss, /\.tab-indicator\s*\{[^}]*position:\s*absolute;[^}]*transition:\s*transform \.24s/s);
  assert.match(liquidGlassCss, /\.tab-indicator\.apps\s*\{[^}]*transform:\s*translateX\(calc\(100% \+ 4px\)\)/s);
  assert.match(liquidGlassCss, /:root \.tab\.active\s*\{[^}]*background:\s*transparent/s);
});

test("a disconnected Vault keeps its accounts protected behind an explicit reconnect action", () => {
  assert.match(currentPageAccountSource, /账号仍在密码库中，需要重新连接/);
  assert.match(currentPageAccountSource, /本机长期保存的 WebDAV 连接材料不可用/);
  assert.match(currentPageAccountSource, /重新连接 \$\{state\.name\}/);
  assert.match(currentPageAccountSource, /添加 WebDAV 连接/);
  assert.match(componentsCss, /\.current-page-reconnect-actions/);
  assert.match(componentsCss, /\.current-page-reconnect-button/);
});

test("an existing WebDAV profile exposes a persistent reconnect flow", () => {
  assert.match(webdavSettingsSource, /const reconnecting = Boolean\(selected\);/);
  assert.match(webdavSettingsSource, /this\.fields\.hidden = false;/);
  assert.match(webdavSettingsSource, /this\.actions\.hidden = false;/);
  assert.match(webdavSettingsSource, /this\.selectionText\.textContent = selected\?\.name \?\? "添加密码库"/);
  assert.match(webdavSettingsSource, /name: this\.name\.value\.trim\(\) \|\| new URL\(endpoint\)\.hostname,/);
  assert.match(webdavSettingsSource, /private renderProfileOptions\(\): void/);
  assert.match(webdavSettingsSource, /label\.textContent = option\.label;[\s\S]*detail\.textContent = option\.detail;/s);
  assert.doesNotMatch(webdavSettingsSource, /innerHTML/);
  assert.match(webdavSettingsSource, /this\.vaultKeyField\.hidden = false;\s*this\.vaultKey\.hidden = false;/);
  assert.match(webdavSettingsSource, /this\.remove\.hidden = !reconnecting;/);
  assert.match(webdavSettingsSource, /new Option\(profile\.name, profile\.id\)/);
  assert.match(webdavSettingsSource, /this\.profile\.value = selectedVaultId \|\| ADD_PROFILE_VALUE;/);
  assert.match(webdavSettingsSource, /this\.profile\.value !== ADD_PROFILE_VALUE[\s\S]*this\.vaultKey\.value\.trim\(\) \? "existing" : "create"/s);
  assert.match(webdavSettingsSource, /getDomRoot\(\)\.addEventListener\("pointerdown"[\s\S]*event\.composedPath\(\)\.includes\(this\.picker\)/s);
  assert.match(webdavSettingsSource, /this\.selection\.addEventListener\("click", \(\) => this\.toggleProfilePicker\(\)\)/);
  assert.doesNotMatch(webdavSettingsSource, /document\.addEventListener\("pointerdown"/);
  assert.doesNotMatch(webdavSettingsSource, /document\.querySelectorAll|modeButtons/);
  assert.match(settingsSource, /await this\.webdavSettings\.open\(vaultId\);\s*if \(this\.disposed\) return;\s*this\.dialog\.classList\.remove\("hidden"\);/);
  assert.match(webdavSettingsSource, /window\.confirm\(`删除“\$\{selected\.name\}”吗？这只会移除扩展中的连接信息，不会删除 WebDAV 服务器上的加密数据。`\)/);
  assert.match(webdavSettingsSource, /type: "removeVault", vaultId: selected\.id/);
  assert.match(popupHtml, /id="webdavVaultKey" type="password"/);
  assert.match(popupHtml, /id="webdavRecoveryKey"[^>]*hidden/);
  assert.match(webdavSettingsSource, /showRecoveryKey\(connection\.recoveryKey\)/);
  assert.match(webdavSettingsSource, /clearSensitiveState\(\): void \{[\s\S]*this\.appPassword\.value = "";[\s\S]*this\.vaultKey\.value = "";[\s\S]*this\.recoveryKey\.value = "";[\s\S]*this\.recovery\.hidden = true;/);
  assert.match(settingsSource, /private close\(\): void \{\s*this\.webdavSettings\.clearSensitiveState\(\);/);
  assert.match(settingsSource, /dispose\(\): void \{\s*this\.disposed = true;\s*this\.webdavSettings\.clearSensitiveState\(\);/);
  assert.match(webdavSettingsSource, /长期保存在本机/);
  assert.match(webdavSettingsSource, /this\.showStatus\("正在测试 WebDAV 连接…"\);/);
  assert.match(webdavSettingsSource, /正在重新连接 WebDAV 密码库/);
  assert.match(webdavSettingsSource, /this\.test\.textContent = this\.operation === "test" \? "测试中…" : "仅测试";/);
  assert.doesNotMatch(webdavSettingsSource, /saveGesture|advancedModeUnlock/);
  assert.match(settingsSource, /this\.versionForm\.addEventListener\("submit", \(event\) => \{ event\.preventDefault\(\); void this\.saveOverride\(\); \}\);/);
  assert.doesNotMatch(settingsSource, /handleSaveClick|SaveGestureStateMachine|selfBuild/);
  assert.match(componentsCss, /\.webdav-status\s*\{[^}]*display:\s*flex/s);
  assert.match(componentsCss, /\.webdav-status\[hidden\][^{]*\{[^}]*display:\s*none !important/s);
  assert.match(componentsCss, /#webdavConnectionFields\s*\{[^}]*display:\s*grid/s);
  assert.match(componentsCss, /#webdavForm\s*\{[^}]*gap:\s*7px;[^}]*padding:\s*12px;/s);
  assert.match(componentsCss, /#webdavForm \.version-override input, #webdavForm \.version-override select\s*\{[^}]*height:\s*30px;/s);
  assert.match(componentsCss, /\.webdav-vault-split\s*\{[^}]*grid-template-columns:\s*minmax\(140px, \.42fr\) 1px minmax\(0, 1fr\)/s);
  assert.match(componentsCss, /\.webdav-vault-divider\s*\{[^}]*width:\s*1px;[^}]*background:\s*var\(--border\)/s);
  assert.match(componentsCss, /\.webdav-vault-picker\s*\{[^}]*position:\s*relative;/s);
  assert.match(componentsCss, /\.webdav-vault-menu\s*\{[^}]*background:\s*rgba\(18, 24, 31, \.94\);[^}]*backdrop-filter:\s*blur\(18px\)/s);
  assert.match(componentsCss, /\.webdav-vault-picker-icon\s*\{[^}]*pointer-events:\s*none;/s);
  assert.match(componentsCss, /\.webdav-vault-remove\s*\{[^}]*color:\s*var\(--text-2\)/s);
  assert.match(componentsCss, /\.webdav-vault-remove:hover\s*\{[^}]*background:\s*var\(--fill-hover\);[^}]*color:\s*var\(--text-1\)/s);
  assert.doesNotMatch(componentsCss, /\.webdav-mode-switch/);
  assert.doesNotMatch(componentsCss, /\.webdav-local-unlock|\.local-unlock-management/);
  assert.doesNotMatch(popupHtml, /id="webdavVaultNameField"/);
  assert.doesNotMatch(popupHtml, /id="chooseWebDavVault"/);
  assert.doesNotMatch(popupHtml, /class="settings-danger" type="button" hidden>删除密码库/);
});

test("settings dialog keeps HTTPS WebDAV connection without system authentication", () => {
  assert.match(popupHtml, /<span class="eyebrow">密码库<\/span><h2 id="versionDialogTitle">WebDAV 连接<\/h2>/);
  assert.match(popupHtml, /id="webdavUrl" type="url"[^>]*placeholder="WebDAV 地址"/);
  assert.doesNotMatch(popupHtml, /查看账号密码或进入 Legacy 高级功能时|系统验证|通行密钥|系统 PIN/);
  assert.match(popupHtml, /以扩展设备密钥加密并长期保存在本机/);
  assert.match(
    settingsSource,
    /url\.protocol !== "https:".*WebDAV 仅支持 HTTPS 地址/s,
  );
  assert.doesNotMatch(settingsSource, /WEBDAV_URL_STORAGE_KEY|openVaultManager/);
});

test("current page vault picker matches the popup control styling", () => {
  assert.match(popupHtml, /id="backToApps" class="icon-button"/);
  assert.match(componentsCss, /\.secondary-heading > #backToApps\s*\{[^}]*border-radius:\s*50%/s);
  assert.match(currentPageAccountSource, /vault\.hidden = true;[\s\S]*className = "current-page-vault-picker"/s);
  assert.match(currentPageAccountSource, /className = "current-page-vault-menu"[\s\S]*setAttribute\("role", "listbox"\)/s);
  assert.match(componentsCss, /\.current-page-vault-menu\s*\{[^}]*position:\s*absolute;[^}]*background:\s*rgba\(18, 24, 31, \.94\)/s);
  assert.match(componentsCss, /#currentAccounts:has\(\.current-page-add\)\s*\{[^}]*overflow:\s*visible/s);
  assert.match(componentsCss, /:root\[data-theme="light"\] \.current-page-vault-menu\s*\{[^}]*background:\s*rgba\(255, 255, 255, \.96\)/s);
});

test("dark online session badge removes its fill on hover", () => {
  assert.match(
    liquidGlassCss,
    /:root\[data-theme="dark"\] \.session-badge\.online:not\(:disabled\):hover\s*\{[^}]*background:\s*transparent;[^}]*filter:\s*none;[^}]*\}/s,
  );
});

test("version settings uses theme-aware layered glass without changing the main window", () => {
  assert.match(
    liquidGlassCss,
    /:root\s*\{[^}]*--dialog-glass:\s*rgba\([^;]+;[^}]*--dialog-panel:\s*rgba\([^;]+;/s,
  );
  assert.match(
    liquidGlassCss,
    /:root\[data-theme="light"\]\s*\{[^}]*--dialog-glass:\s*rgba\([^;]+;[^}]*--dialog-panel:\s*rgba\([^;]+;/s,
  );
  assert.match(
    liquidGlassCss,
    /:root\[data-theme="light"\]\s*\{[^}]*--dialog-scrim:\s*rgba\(255, 255, 255, \.32\);/s,
  );
  assert.match(
    liquidGlassCss,
    /\.dialog-backdrop\s*\{[^}]*background:\s*var\(--dialog-scrim\);[^}]*backdrop-filter:\s*blur\(10px\) saturate\(120%\)/s,
  );
  assert.match(
    liquidGlassCss,
    /\.version-dialog\s*\{[^}]*background-color:\s*var\(--dialog-glass\);[^}]*backdrop-filter:\s*blur\(24px\) saturate\(155%\)/s,
  );
  assert.match(
    liquidGlassCss,
    /--glass-grain:\s*url\([^;]*feTurbulence type='fractalNoise'[^;]*opacity='\.12'/s,
  );
  assert.match(
    liquidGlassCss,
    /\.version-dialog\s*\{[^}]*background:\s*var\(--glass-grain\);[^}]*background-blend-mode:\s*soft-light;/s,
  );
  assert.match(
    liquidGlassCss,
    /\.version-dialog \.settings-form\s*\{[^}]*background:\s*var\(--dialog-panel\);[^}]*backdrop-filter:\s*blur\(8px\)/s,
  );
});
