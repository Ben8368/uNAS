import { readdir, readFile, stat } from 'node:fs/promises'
import { resolve, relative, dirname } from 'node:path'
import { createHash } from 'node:crypto'
const root = resolve(import.meta.dirname, '..')
const output = resolve(root, 'apps/extension/.output/chrome-mv3')
const budgets = JSON.parse(await readFile(resolve(root, 'scripts/demo-budgets.json'), 'utf8'))
const provenance = JSON.parse(await readFile(resolve(root, 'assets/demo-assets.json'), 'utf8'))
const errors = []
async function filesIn(directory) {
  const files = []
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, item.name)
    files.push(...item.isDirectory() ? await filesIn(path) : [path])
  }
  return files
}
const knownAssets = new Set()
for (const record of provenance.assets) {
  const data = await readFile(resolve(root, record.path))
  if (data.length !== record.bytes || createHash('sha256').update(data).digest('hex') !== record.sha256) errors.push(`素材哈希不一致: ${record.path}`)
  if (record.path.includes('/public/')) {
    knownAssets.add(resolve(root, record.path))
    if (data.length > budgets.singleAssetBytes) errors.push(`单素材超预算: ${record.path}`)
    if (record.width > budgets.svgWidth || record.height > budgets.svgHeight) errors.push(`SVG 尺寸超预算: ${record.path}`)
    if (/<(?:script|foreignObject|image)\b/i.test(data.toString())) errors.push(`SVG 包含主动或外部内容: ${record.path}`)
  }
}
let assetBytes = 0
for (const file of await filesIn(resolve(root, 'apps/extension/public'))) {
  if (!knownAssets.has(file)) errors.push(`未登记来源的素材: ${relative(root, file)}`)
  assetBytes += (await stat(file)).size
}
if (assetBytes > budgets.allPublicAssetsBytes) errors.push('public 素材总量超预算')
const manifest = JSON.parse(await readFile(resolve(output, 'manifest.json'), 'utf8'))
const archiveWorker = resolve(output, 'archive-worker.js')
try {
  await stat(archiveWorker)
} catch {
  errors.push('Archive ZIP Worker 未进入扩展包；文件管理不能引用未打包的 Worker。')
}
const allowedPermissions = new Set(['activeTab', 'scripting', 'clipboardWrite', 'storage', 'alarms', 'tabs', 'declarativeNetRequest', 'downloads'])
for (const permission of manifest.permissions ?? []) if (!allowedPermissions.has(permission)) errors.push(`uNAS 未登记的 permission: ${permission}`)
const requiredPermissions = [...allowedPermissions]
for (const permission of requiredPermissions) if (!manifest.permissions?.includes(permission)) errors.push(`uNAS 缺少已审查 permission: ${permission}`)
if (JSON.stringify(manifest.optional_host_permissions) !== JSON.stringify(['https://*/*'])) errors.push('WebDAV optional_host_permissions 必须保持 HTTPS 全域、仅在用户触发时申请。')
if (!manifest.declarative_net_request?.rule_resources?.some((resource) => resource.id === 'baseline' && resource.path === 'rules/baseline.json')) errors.push('DNR baseline 未进入最终 manifest。')
if (!manifest.content_scripts?.some((script) => script.js?.some((file) => file.includes('adblock')) && script.matches?.includes('https://*/*'))) errors.push('AdBlock cosmetic content script 未进入最终 manifest。')
if (!manifest.web_accessible_resources?.some((resource) => resource.resources?.includes('icons/icon48.png'))) errors.push('浮层品牌资源未限制性公开。')
let total = 0
for (const file of await filesIn(output)) {
  total += (await stat(file)).size
  if (/\.wasm$/i.test(file) && relative(output, file) !== 'credential-core.wasm') errors.push(`未知 WASM 进入扩展包: ${relative(output, file)}`)
  if (/\.js$/.test(file) && /unasDesktop|WebContentsView|ffmpeg\.wasm/.test(await readFile(file, 'utf8'))) errors.push(`构建物包含桌面或引擎路径: ${relative(output, file)}`)
}
if (total > budgets.totalExtensionBytes) errors.push(`扩展包体超预算: ${total}`)
// Static imports + modulepreload only: lazy tool chunks are not initial New Tab JS.
const html = await readFile(resolve(output, 'newtab.html'), 'utf8')
const queue = [...html.matchAll(/(?:src|href)="([^"]+\.js)"/g)].map(match => resolve(output, match[1].replace(/^\//, '')))
// The error-recovery bootstrap dynamically imports main on every New Tab open.
for (const file of await filesIn(resolve(output, 'chunks'))) if (/[/\\]main-[^/\\]+\.js$/.test(file)) queue.push(file)
const seen = new Set()
let initial = 0
while (queue.length) {
  const file = queue.shift()
  if (seen.has(file)) continue
  seen.add(file)
  const code = await readFile(file, 'utf8')
  initial += Buffer.byteLength(code)
  for (const match of code.matchAll(/(?:\bfrom\s*|\bimport\s*)["']([^"']+\.js)["']/g)) queue.push(resolve(dirname(file), match[1]))
}
if (initial > budgets.initialNewTabJavaScriptBytes) errors.push(`New Tab 初始静态 JS 超预算: ${initial}`)
if (!await stat(resolve(output, 'passwords.html')).catch(() => null)) errors.push('密码管理器页面未进入扩展包。')
for (const file of ['background.js', 'page-overlay.js', 'content-script.js', 'credential-core.wasm']) if (!await stat(resolve(output, file)).catch(() => null)) errors.push(`关键 UniPass 产物缺失: ${file}`)
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1 }
else console.log(`uNAS 集成包检查通过: total=${total} B, initial static JS=${initial} B, public=${assetBytes} B；单一 MV3 background + AdBlock/Vault/浮层产物已登记。`)
