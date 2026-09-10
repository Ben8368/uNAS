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
const allowedPermissions = new Set(['storage', 'downloads'])
for (const field of ['host_permissions', 'optional_host_permissions', 'web_accessible_resources', 'content_scripts']) {
  if (manifest[field]?.length) errors.push(`Phase 1 不允许未经审查的 ${field}`)
}
for (const permission of manifest.permissions ?? []) if (!allowedPermissions.has(permission)) errors.push(`Phase 1 不允许未经审查的 permissions: ${permission}`)
let total = 0
for (const file of await filesIn(output)) {
  total += (await stat(file)).size
  if (/\.wasm$/i.test(file)) errors.push('Demo 不允许包含 WASM')
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
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1 }
else console.log(`Demo 打包检查通过: total=${total} B, initial static JS=${initial} B, public=${assetBytes} B；required storage + downloads 权限，无 WASM/桌面 bridge。`)
