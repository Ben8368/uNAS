// Static import-boundary gate for apps/extension. Every violation prints: source file, illegal import, violated rule.
//   node scripts/architecture-boundary-check.mjs                    check (fails on new or stale baseline entries)
//   node scripts/architecture-boundary-check.mjs --write-baseline   regenerate scripts/architecture-boundary-baseline.json
import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'

const root = path.resolve(import.meta.dirname, '..')
const app = path.join(root, 'apps/extension')
const srcRoot = path.join(app, 'src')
const baselinePath = path.join(root, 'scripts/architecture-boundary-baseline.json')
const ts = createRequire(path.join(app, 'package.json'))('typescript')
const posix = value => value.split(path.sep).join('/')
const rel = value => posix(path.relative(root, value))

// The internal password compatibility package has one adapter and one public entry.
const PASSWORD_COMPAT_PACKAGE = '@unas/password-compat'
const PASSWORD_COMPAT_PUBLIC = new Set(['@unas/password-compat/legacy'])
const PASSWORD_COMPAT_CONSUMER = 'apps/extension/src/features/password-manager/legacy/adapter.ts'
const PASSWORD_COMPAT_TEST_CONSUMERS = new Set(['apps/extension/src/features/password-manager/shared/plugin-version.test.ts'])

// What other features and the shell may import from a feature. Everything else in it is internal.
const FEATURE_PUBLIC = {
  // background/service-worker.ts is each feature's composition surface (install*/handle*/is*Message); platform/extension routes to it.
  adblock: ['ui.tsx', 'ui.css', 'contracts.ts', 'background/service-worker.ts'],
  'password-manager': ['ui.tsx', 'ui.css', 'WebDavSettings.tsx', 'background/service-worker.ts'],
  music: ['ui.tsx'],
  browser: ['BrowserApp.tsx'],
  downloader: ['DownloaderApp.tsx'],
  'file-manager': ['FileManagerApp.tsx', 'FileWorkspaceModeControl.tsx'],
  settings: ['SettingsApp.tsx', 'ColorGamutStatus.tsx'],
  logs: ['LogViewer.tsx'],
  psd: ['PsdApp.tsx'],
  transcode: ['TranscodeApp.tsx'],
  'demo-tool': ['DemoToolApp.tsx'],
}
const SRC_BUCKETS = new Set(['shell', 'features', 'platform', 'shared'])

const roots = ['src', 'entrypoints', 'contracts', 'e2e', 'e2e-web'].map(name => path.join(app, name))
const aliases = [['unas-src/', srcRoot], ['#contracts', path.join(app, 'contracts/index.ts')]]
const skipDirectories = new Set(['node_modules', '.output', '.wxt', 'dist'])

async function walk(directory, found = []) {
  let entries
  try { entries = await readdir(directory, { withFileTypes: true }) } catch { return found }
  for (const entry of entries) {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) { if (!skipDirectories.has(entry.name)) await walk(full, found) } else found.push(full)
  }
  return found
}
const allFiles = new Set()
for (const directory of roots) for (const file of await walk(directory)) allFiles.add(path.resolve(file))
const scanTargets = [...allFiles].filter(file => /\.(?:ts|tsx|mts)$/.test(file) && !file.endsWith('.d.ts')).sort()

function specifiersOf(text, file) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const found = []
  const visit = node => {
    const spec = (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) ? node.moduleSpecifier
      : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0] : undefined
    if (spec && ts.isStringLiteral(spec)) found.push(spec.text)
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

/** Resolve a specifier to a repository file when it points inside the repository; otherwise null. */
function resolveInternal(specifier, from) {
  let base = null
  for (const [prefix, target] of aliases) {
    if (specifier === prefix) base = target
    else if (prefix.endsWith('/') && specifier.startsWith(prefix)) base = path.join(target, specifier.slice(prefix.length))
  }
  if (!base && specifier.startsWith('.')) base = path.resolve(path.dirname(from), specifier.split('?')[0])
  if (!base) return null
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
    if (allFiles.has(path.resolve(candidate))) return path.resolve(candidate)
  }
  return path.resolve(base)
}

/** {bucket, unit, inner} for a file under src, else null. unit is the feature / platform area name. */
function placeOf(file) {
  const parts = posix(path.relative(srcRoot, file)).split('/')
  if (parts[0].startsWith('..')) return null
  const bucket = parts[0]
  if (bucket === 'features' || bucket === 'platform') return { bucket, unit: parts[1], inner: parts.slice(2).join('/') }
  return { bucket, unit: undefined, inner: parts.slice(1).join('/') }
}
const isFeatureUi = (place, target) => place.bucket === 'features' && (/\.(?:tsx|css)$/.test(target) || /(^|\/)(?:popup|manage)\//.test(place.inner))
const isPrivatePlatformPath = place => place.bucket === 'platform' && /(^|\/)(?:real|test-support)(\/|$)/.test(place.inner)

// Baselined rules: existing coupling that is registered, may only shrink. Structural/password-compat rules are never baselined.
const layerRules = [
  ['shared-no-upward', (from, to) => from.bucket === 'shared' && (to.bucket === 'features' || to.bucket === 'shell') && 'shared 不得依赖 features 或 shell（shared 只放多个 feature 共用且无业务 owner 的代码）'],
  ['platform-no-shell', (from, to) => from.bucket === 'platform' && to.bucket === 'shell' && 'platform 不得依赖 shell'],
  ['platform-no-feature-ui', (from, to, target) => from.bucket === 'platform' && isFeatureUi(to, target) && 'platform 不得依赖 feature UI（组件/样式/popup/manage）'],
  ['feature-no-cross-internal', (from, to, target) => from.bucket === 'features' && to.bucket === 'features' && from.unit !== to.unit
    && !(FEATURE_PUBLIC[to.unit] ?? []).includes(to.inner) && `feature ${from.unit} 不得导入 feature ${to.unit} 的内部路径（只能用其 public entry：${(FEATURE_PUBLIC[to.unit] ?? ['无']).join(', ')}）`],
  ['shell-no-feature-internal', (from, to) => from.bucket === 'shell' && to.bucket === 'features'
    && !(FEATURE_PUBLIC[to.unit] ?? []).includes(to.inner) && `shell 不得导入 feature ${to.unit} 的内部实现（只能用其 public entry：${(FEATURE_PUBLIC[to.unit] ?? ['无']).join(', ')}）`],
  ['ui-no-deep-platform', (from, to, target, source) => /\.tsx$/.test(source) && from.bucket !== 'platform' && isPrivatePlatformPath(to)
    && 'React UI 不得深入调用 platform 的 real/ 或 test-support/ 实现；使用该 platform 区域顶层的 port/facade'],
]
const hardRules = [
  (file, specifier, resolved) => {
    const target = resolved ? rel(resolved) : specifier
    if (/(^|\/)sources\/[^/]+(\/|$)/.test(target)) return '禁止依赖已移除的 sources/；uNAS 源码事实源是 packages/password-compat'
    if (/(^|\/)packages\/password-compat\/(?!node_modules)/.test(target)) return '禁止通过文件路径深导入 packages/password-compat；只能经由 package public export'
  },
  (file, specifier) => {
    if (specifier !== PASSWORD_COMPAT_PACKAGE && !specifier.startsWith(`${PASSWORD_COMPAT_PACKAGE}/`)) return
    if (!PASSWORD_COMPAT_PUBLIC.has(specifier)) return `@unas/password-compat 只公开 ${[...PASSWORD_COMPAT_PUBLIC].join(', ')}；未声明的子路径不属于 public API`
    if (rel(file) !== PASSWORD_COMPAT_CONSUMER && !PASSWORD_COMPAT_TEST_CONSUMERS.has(rel(file))) return `uNAS 只能由 ${PASSWORD_COMPAT_CONSUMER} 这一个 adapter 消费（测试夹具除外）`
  },
]

const hard = []
const layered = new Map()
for (const file of scanTargets) {
  const from = placeOf(file)
  for (const specifier of specifiersOf(await readFile(file, 'utf8'), file)) {
    const resolved = resolveInternal(specifier, file)
    for (const rule of hardRules) {
      const message = rule(file, specifier, resolved)
      if (message) hard.push(`${rel(file)}\n    非法导入: ${specifier}\n    违反规则: ${message}`)
    }
    const to = resolved && placeOf(resolved)
    if (!from || !to || !allFiles.has(resolved)) continue
    for (const [id, test] of layerRules) {
      const message = test(from, to, rel(resolved), file)
      if (message) layered.set(`${rel(file)} -> ${specifier} [${id}]`, { file: rel(file), specifier, id, message })
    }
  }
}

const structural = []
for (const entry of await readdir(srcRoot, { withFileTypes: true })) {
  if (!SRC_BUCKETS.has(entry.name) && entry.name !== 'vite-env.d.ts') structural.push(`apps/extension/src/${entry.name}\n    非法导入: 顶层目录 ${entry.name}\n    违反规则: src 只允许 shell/ features/ platform/ shared/（及 vite-env.d.ts）；按 owner 归入其一，不要新增分类桶`)
}
const passwordCompatPackage = JSON.parse(await readFile(path.join(root, 'packages/password-compat/package.json'), 'utf8'))
const exported = Object.keys(passwordCompatPackage.exports ?? {})
if (exported.length === 0 || exported.some(key => key.includes('*'))) structural.push(`packages/password-compat/package.json\n    非法导入: exports ${JSON.stringify(exported)}\n    违反规则: 必须声明显式 exports，禁止通配符暴露 ./src/*`)
if (!await stat(path.join(root, '.gitmodules')).then(() => false, () => true)) structural.push('.gitmodules\n    非法导入: submodule 记录\n    违反规则: uNAS 已迁入 packages/password-compat，仓库不再使用 submodule')

if (process.argv.includes('--write-baseline')) {
  const entries = [...layered.keys()].sort()
  await writeFile(baselinePath, JSON.stringify({
    schemaVersion: 1,
    purpose: 'Registered architecture coupling (TD-004). The list may only shrink: new violations fail the check, and entries that no longer occur must be deleted.',
    violations: entries,
  }, null, 2) + '\n')
  console.log(`已写入基线：${entries.length} 条（${rel(baselinePath)}）`)
  process.exit(0)
}

const baseline = new Set(JSON.parse(await readFile(baselinePath, 'utf8')).violations)
const fresh = [...layered].filter(([key]) => !baseline.has(key)).map(([, v]) => `${v.file}\n    非法导入: ${v.specifier}\n    违反规则: [${v.id}] ${v.message}`)
const stale = [...baseline].filter(key => !layered.has(key)).map(key => `scripts/architecture-boundary-baseline.json\n    过期基线: ${key}\n    违反规则: 该耦合已消失，请从基线删除（基线只减不增）`)
const failures = [...hard, ...structural, ...fresh, ...stale]
if (failures.length) {
  console.error(`架构边界检查失败（${failures.length} 处）：\n${failures.join('\n')}`)
  process.exitCode = 1
} else {
  console.log(`架构边界检查通过：扫描 ${scanTargets.length} 个源码文件，已登记耦合 ${baseline.size} 条（静态导入图，不替代运行时权限验收）。`)
}
