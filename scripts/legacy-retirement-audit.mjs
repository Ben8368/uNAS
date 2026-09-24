// Read-only TD-003 inventory. Presence/absence is not a retirement acceptance gate.
import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
const root = path.resolve(import.meta.dirname, '..')
const app = path.join(root, 'apps/extension')
const ts = createRequire(path.join(app, 'package.json'))('typescript')
const moduleRoot = path.join(app, 'src/modules/password-manager')
const relative = value => path.relative(root, value).replaceAll('\\', '/')
async function exists(file) { try { return (await stat(file)).isFile() } catch { return false } }
async function filesIn(dir) {
  const result = []
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name)
    if (item.isDirectory()) result.push(...await filesIn(full))
    else if (/\.tsx?$/.test(item.name) && !/\.(?:test|d)\.ts$/.test(item.name)) result.push(full)
  }
  return result
}
const graph = new Map()
const imports = []
const unresolved = []
const legacyUiReferences = []
const legacyMessages = new Set(['session', 'startUniPassLogin', 'completeUniPassLogin', 'getPluginVersionSettings', 'setPluginVersionOverride', 'getJupiterKeepalive', 'setJupiterKeepalive', 'accountCatalog', 'currentPageCatalog'])
for (const file of await filesIn(moduleRoot)) {
  const text = await readFile(file, 'utf8')
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const specs = []
  function visit(node) {
    const spec = (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) ? node.moduleSpecifier
      : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0] : undefined
    if (spec && ts.isStringLiteral(spec)) specs.push({ value: spec.text, line: source.getLineAndCharacterOfPosition(spec.getStart(source)).line + 1 })
    if (ts.isStringLiteral(node) && (legacyMessages.has(node.text) || node.text === 'legacy-unipass') && file.includes(path.sep + 'popup' + path.sep)) {
      legacyUiReferences.push({ from: relative(file), line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, messageOrFallback: node.text })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  const edges = []
  for (const spec of specs) {
    if (!spec.value.startsWith('.')) continue
    const base = path.resolve(path.dirname(file), spec.value.split('?')[0])
    const candidates = [base, base + '.ts', base + '.tsx', path.join(base, 'index.ts'), path.join(base, 'index.tsx')]
    let target
    for (const candidate of candidates) if (await exists(candidate)) { target = candidate; break }
    if (!target) { unresolved.push({ from: relative(file), line: spec.line, specifier: spec.value }); continue }
    edges.push(target)
    imports.push({ from: relative(file), line: spec.line, to: relative(target) })
  }
  graph.set(file, edges)
}
const targetNames = ['shared/api.ts', 'background/credential-core.ts', 'background/legacy-credential-source.ts', 'background/legacy-catalog.ts', 'background/unipass-login.ts', 'background/jupiter-keepalive.ts']
const targets = new Set(targetNames.map(name => path.join(moduleRoot, name)))
const roots = ['background/service-worker.ts', 'background/credential-access.ts', 'background/page-overlay.ts', 'background/user-scope-guard.ts', 'popup/popup.ts', 'popup/settings.ts', 'popup/catalog.ts']
function pathsToLegacy(start) {
  const queue = [[start]]
  const seen = new Set([start])
  const found = []
  for (let i = 0; i < queue.length; i++) {
    const route = queue[i]
    const last = route.at(-1)
    if (targets.has(last)) found.push(route.map(relative))
    for (const next of graph.get(last) ?? []) if (!seen.has(next)) { seen.add(next); queue.push([...route, next]) }
  }
  return found
}
const output = path.join(app, '.output/chrome-mv3')
const built = await exists(path.join(output, 'manifest.json'))
const manifest = built ? JSON.parse(await readFile(path.join(output, 'manifest.json'), 'utf8')) : undefined
const artifacts = []
for (const name of ['credential-core.wasm', 'runtime-config.json']) {
  if (!await exists(path.join(output, name))) continue
  const bytes = await readFile(path.join(output, name))
  artifacts.push({ name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
}
const targetPaths = new Set([...targets].map(relative))
console.log(JSON.stringify({
  scope: 'TD-003 static dependency/artifact inventory; no network, user storage or credential reads',
  evidenceLimit: 'Type-only imports are included conservatively. CSS/HTML/runtime message edges and tree shaking require separate review. Build must be refreshed before interpreting artifacts. Not proof that disabling the registry removes Legacy.',
  compilerVersion: ts.version,
  directLegacyImports: imports.filter(edge => targetPaths.has(edge.to)),
  reachableLegacy: roots.map(name => ({ root: name, paths: pathsToLegacy(path.join(moduleRoot, name)) })),
  legacyUiReferences,
  unresolvedRelativeImports: unresolved,
  build: { present: built, version: manifest?.version, legacyHostPermissions: manifest?.host_permissions?.filter(host => /unipass|feishu|jupiter/.test(host)), artifacts },
  retirementAccepted: false,
  remainingGates: ['Composition adapter isolation and WebDAV-only routing', 'Disabled-adapter whole-package/manifest/network regression', 'Real authorized WebDAV conflict recovery', 'Target Chrome toolbar gestures and data preservation'],
}, null, 2))
