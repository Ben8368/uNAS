import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";


const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(await readFile(resolve(root, "public/manifest.json"), "utf8"));
const errors = [];
const warnings = [];
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const CHROME_VERSION_COMPONENT_MAX = 65535;
const versionParts = parseChromeVersion(manifest.version);
const pluginVersion = await readFile(resolve(root, "src/shared/plugin-version.ts"), "utf8");
const rustToolchain = await readFile(resolve(root, "rust-toolchain.toml"), "utf8");
const rustManifest = await readFile(resolve(root, "credential-core/Cargo.toml"), "utf8");
const rustLock = await readFile(resolve(root, "credential-core/Cargo.lock"), "utf8");
const security = await readFile(resolve(root, "SECURITY.md"), "utf8");
const storeBaselineMatch = pluginVersion.match(/LEGACY_PLUGIN_VERSION\s*=\s*["'](\d+)\.(\d+)\.(\d+)["']/);
if (packageJson.version !== manifest.version) errors.push("package.json 与 manifest 版本必须一致");
if (manifest.key || manifest.update_url) errors.push("内部测试壳不得绑定外部商店身份或更新源");
if (manifest.name !== "uNAS" || manifest.action?.default_title !== "uNAS") errors.push("对外品牌必须为 uNAS");
if (!versionParts) errors.push("manifest 版本必须为三段非负整数，且每段不超过 65535");
if (!storeBaselineMatch) {
  errors.push("必须在 src/shared/plugin-version.ts 声明三段式 LEGACY_PLUGIN_VERSION");
}

const allowedPermissions = new Set(["activeTab", "scripting", "clipboardWrite", "storage", "alarms", "tabs", "declarativeNetRequest"]);
const allowedHosts = new Set([
  "https://*/*",
  "https://portal.unipass.top/*",
  "https://accounts.feishu.cn/*",
  "https://jupiter.tec-do.com/*",
  "https://easylist-downloads.adblockplus.org/*",
]);

for (const permission of manifest.permissions ?? []) {
  if (!allowedPermissions.has(permission)) errors.push(`manifest 出现未审计权限：${permission}`);
}
for (const host of manifest.host_permissions ?? []) {
  if (!allowedHosts.has(host)) errors.push(`manifest 出现未审计主机：${host}`);
  if (host === "<all_urls>" || (!host.startsWith("https://") && host !== "http://*/*")) errors.push(`manifest 主机范围不安全：${host}`);
}
for (const host of manifest.optional_host_permissions ?? []) {
  if (host !== "https://*/*") errors.push(`manifest 出现未审计可选主机：${host}`);
  if (host === "<all_urls>" || !host.startsWith("https://")) errors.push(`manifest 可选主机范围不安全：${host}`);
}
const cosmeticScripts = manifest.content_scripts ?? [];
if (cosmeticScripts.length !== 1 || JSON.stringify(cosmeticScripts[0]?.matches?.slice().sort()) !== JSON.stringify(["http://*/*", "https://*/*"])) {
  errors.push("广告 cosmetic content_scripts 必须精确声明 HTTP(S) 页面范围");
}
if (cosmeticScripts.some((entry) => entry.js?.includes("content/content-script.js") || entry.js?.includes("content/page-overlay.js"))) {
  errors.push("密码填充和页面浮层脚本不得进入常驻广告 content_scripts");
}
if (!cosmeticScripts.every((entry) => entry.run_at === "document_start" && entry.all_frames === true && entry.world === "ISOLATED" && JSON.stringify(entry.js) === JSON.stringify(["content/cosmetic-content.js"]))) {
  errors.push("广告 content script 必须使用 document_start/all_frames/ISOLATED 及固定本地入口");
}
if (!manifest.permissions?.includes("declarativeNetRequest")) errors.push("广告拦截必须声明 declarativeNetRequest 权限");
const ruleResources = manifest.declarative_net_request?.rule_resources;
if (!Array.isArray(ruleResources) || ruleResources.length !== 1 || ruleResources[0]?.id !== "baseline" || ruleResources[0]?.enabled !== true || ruleResources[0]?.path !== "rules/baseline.json") {
  errors.push("必须只声明经过审计的小型 baseline DNR 规则集；完整列表仍来自后台订阅");
}

const api = await readFile(resolve(root, "src/shared/api.ts"), "utf8");
if (!api.includes("readPluginVersionOverride") || !api.includes("readRuntimeConfig") || !api.includes("RUNTIME_CONFIG_FILE")) {
  errors.push("uNAS 网络请求版号必须以经校验的手动覆盖或本地 runtime-config.json 为来源，不能使用本地 manifest 版本");
}
if (manifest.background?.type !== "module") errors.push("Manifest V3 Service Worker 必须保持 module 类型");
if (!String(manifest.content_security_policy?.extension_pages ?? "").includes("script-src 'self'")) {
  errors.push("扩展页面 CSP 必须限制 script-src 为 self");
}
if (!String(manifest.content_security_policy?.extension_pages ?? "").includes("'wasm-unsafe-eval'")) {
  errors.push("本地 credential core 需要 MV3 CSP 明确允许 wasm-unsafe-eval");
}

const packageDependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
if (packageDependencies["crypto-js"] || packageDependencies["@types/crypto-js"]) {
  errors.push("credential core 迁移后不得继续依赖 crypto-js 或其类型包");
}
if (/CryptoJS|VlXCSJg7qO66MNrMMJir3g==/.test(api)) {
  errors.push("uNAS API 生产源码不得保留 CryptoJS 或完整固定解密材料");
}
if (!/channel\s*=\s*["']1\.98\.1["']/.test(rustToolchain)) errors.push("Rust toolchain 必须固定为 1.98.1");
if (!/edition\s*=\s*["']2024["']/.test(rustManifest)) errors.push("credential-core 必须使用 Rust 2024 edition");
if (/\bgit\s*=|git\+/.test(`${rustManifest}\n${rustLock}`)) errors.push("Rust 依赖不得使用 git source");

// CI ownership belongs exclusively to the root uNAS workflow.

const credentialCore = await readFile(resolve(root, "src/background/credential-core.ts"), "utf8");
if (!credentialCore.includes("chrome.runtime.getURL(CORE_FILE)") || !credentialCore.includes("WebAssembly.instantiate")) {
  errors.push("credential core 必须从扩展本地 URL 通过单一 loader 初始化");
}
for (const exportName of ["c_v", "c_k", "credentialAvailableCiphertext", "transformJupiterCredentialCiphertext"]) {
  if (!credentialCore.includes(exportName)) errors.push(`credential core 缺少 ${exportName} 路径`);
}
if (credentialCore.includes("transformJupiterPassword")) errors.push("生产 JS 不得暴露原始 Jupiter password transform API");

const jupiterKeepalive = await readFile(resolve(root, "src/background/jupiter-keepalive.ts"), "utf8");
if (!jupiterKeepalive.includes("jupiterCredentialForAccount") || /credentialForAccount|transformJupiterPassword/.test(jupiterKeepalive)) {
  errors.push("Jupiter keepalive 必须直接使用 ciphertext combined transform，不得取得原始 password");
}

const contentScript = await readFile(resolve(root, "src/content/content-script.ts"), "utf8");
if (/\.(?:submit|requestSubmit)\s*\(/.test(contentScript)) {
  errors.push("Content Script 不得自动提交表单");
}
if (contentScript.includes("data-unipass-minimal-listener") || !contentScript.includes("__unipassMinimalListenerInstalled")) {
  errors.push("Content Script listener 状态必须使用 isolated-world 状态，不得依赖页面 DOM marker");
}
if (!security.includes("Jupiter transformedPassword") || !security.includes("credential-equivalent secret")) {
  errors.push("SECURITY.md 必须将 Jupiter transformedPassword 分类为 credential-equivalent secret");
}
const buildScript = await readFile(resolve(root, "build.mjs"), "utf8");
for (const [pattern, error] of [
  [/\bminify:\s*true\b/, "发布构建必须启用标准 minify"],
  [/\bsourcemap:\s*false\b/, "发布构建必须关闭 sourcemap"],
  [/\btreeShaking:\s*true\b/, "发布构建必须启用 tree shaking"],
  [/\bdrop:\s*\[\s*["']debugger["']\s*\]/, "发布构建必须移除 debugger"],
  [/\blegalComments:\s*["']eof["']/, "发布构建必须在文件末尾保留第三方许可声明"],
  [/\baudit\s*=\s*assertReleaseArtifact/, "普通构建必须使用 release artifact audit"],
  [/\bawait\s+audit\(out\)/, "构建完成后必须审计最终 dist 产物"],
  [/\bconst\s+wasmPath\s*=\s*resolve\(out,\s*["']credential-core\.wasm["']\)/, "构建必须生成并复制 credential-core.wasm"],
]) {
  if (!pattern.test(buildScript)) errors.push(error);
}

const loginAssistant = await readFile(resolve(root, "src/background/legacy-login.ts"), "utf8");
if (!loginAssistant.includes('url.searchParams.get("client_id") === "cli_aae6da4f6538dbed"')
  || !loginAssistant.includes('url.searchParams.get("redirect_uri") === "https://tec-iam.tec-do.com/portal/api/v1/login/feishu_oauth/gboh9uvzolazw62gmxojwaarust5qyvh"')) {
  errors.push("飞书授权点击必须同时固定 Tec-IAM OAuth client_id 和 redirect_uri");
}

for (const file of await sourceFiles(resolve(root, "src"))) {
  const content = await readFile(file, "utf8");
  const lines = content.trimEnd().split(/\r?\n/).length;
  const label = relative(root, file).replaceAll("\\", "/");
  if (lines > 650) errors.push(`${label}: ${lines} 行，超过 650 行红灯阈值`);
  else if (lines > 500) warnings.push(`${label}: ${lines} 行，超过 500 行黄灯阈值，应按 TECH_DEBT 跟踪拆分`);
  else if (lines > 350) warnings.push(`${label}: ${lines} 行，审查时需确认单一职责`);
}

if (errors.length) {
  console.error("🚦 Static Audit: RED");
  for (const error of errors) console.error(`🔴 ${error}`);
  for (const warning of warnings) console.warn(`🟡 ${warning}`);
  process.exitCode = 1;
} else if (warnings.length) {
  console.warn("🚦 Static Audit: YELLOW");
  for (const warning of warnings) console.warn(`🟡 ${warning}`);
} else {
  console.log("🚦 Static Audit: GREEN");
}

async function sourceFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(path));
    else if ([".ts", ".tsx"].includes(extname(entry.name))) files.push(path);
  }
  return files;
}

function parseChromeVersion(value) {
  if (typeof value !== "string") return null;
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value);
  if (!match) return null;
  const parts = match.slice(1).map(Number);
  return parts.every((part) => Number.isInteger(part) && part >= 0 && part <= CHROME_VERSION_COMPONENT_MAX) ? parts : null;
}
