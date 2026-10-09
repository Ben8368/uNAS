// Deterministic uNAS -> UniPass distribution export. One direction only: never pushes, never fetches.
//   node scripts/unipass-export.mjs [--out <dir>] [--check] [--strict]
// Output defaults to .artifacts/unipass-export (git-ignored). Deletion is limited to that tree.
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'

const root = resolve(import.meta.dirname, '..')
const source = resolve(root, 'packages/unipass')
const sourceRel = 'packages/unipass'
const args = process.argv.slice(2)
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined }
const defaultOut = resolve(root, '.artifacts/unipass-export')

const forbiddenSegments = new Set(['.git', 'node_modules', 'dist', 'target', 'artifacts', '.env'])
const forbiddenNames = /(^|\/)(\.env(\..*)?|.*\.(pem|key|p12|pfx)|id_(rsa|ed25519)|credentials\.json)$/i
const secretPatterns = [
  [/-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/, 'private key block'],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}\b/, 'GitHub token'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key id'],
  [/\bnpm_[A-Za-z0-9]{36}\b/, 'npm token'],
]
// Files the standalone repository cannot build or release without.
const required = [
  'package.json', 'package-lock.json', 'tsconfig.json', 'build.mjs', 'rust-toolchain.toml',
  'public/manifest.json', 'credential-core/Cargo.toml', 'credential-core/Cargo.lock',
  'scripts/traffic-light-check.mjs', 'scripts/build-wasm.mjs', 'scripts/chrome-smoke.mjs',
  '.github/workflows/ci.yml', '.github/workflows/release.yml', '.gitignore', 'README.md', 'SECURITY.md',
]

function git(...gitArgs) {
  return execFileSync('git', gitArgs, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

function safeOutputDirectory(directory) {
  const inArtifacts = !relative(resolve(root, '.artifacts'), directory).startsWith('..')
  const inTemp = !relative(tmpdir(), directory).startsWith('..')
  if (!inArtifacts && !inTemp) throw new Error(`拒绝在 .artifacts 或系统临时目录之外写入/清空：${directory}`)
  if (directory === resolve(root, '.artifacts') || directory === tmpdir()) throw new Error('输出目录必须是专属子目录。')
  return directory
}

/** Tracked plus untracked-but-not-ignored files: the working tree is the source of truth. */
function sourceFiles() {
  const listed = git('ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', sourceRel).split('\0').filter(Boolean)
  return [...new Set(listed)].map(path => path.slice(sourceRel.length + 1)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

async function exportTree(out) {
  const problems = []
  const files = []
  for (const name of sourceFiles()) {
    const absolute = resolve(source, name)
    if (!await stat(absolute).then(info => info.isFile(), () => false)) continue // tracked but deleted in the working tree
    if (name.split('/').some(segment => forbiddenSegments.has(segment)) || forbiddenNames.test(name)) {
      problems.push(`${name}: 路径属于不得导出的类别`)
      continue
    }
    const bytes = await readFile(absolute)
    if (!bytes.includes(0)) {
      const text = bytes.toString('utf8')
      for (const [pattern, label] of secretPatterns) if (pattern.test(text)) problems.push(`${name}: 疑似 ${label}`)
      if (/(?:\.\.\/){2,}(?:apps|packages|sources|docs)\b|\bsources\/UniPass\b|\bapps\/extension\b/.test(text) && /\.(?:[cm]?[jt]sx?|json|ya?ml)$/.test(name)) {
        problems.push(`${name}: 引用了 UniPass 包之外的 uNAS 路径`)
      }
    }
    files.push({ name, bytes })
  }
  const present = new Set(files.map(file => file.name))
  for (const name of required) if (!present.has(name)) problems.push(`${name}: standalone 构建/发布必需文件缺失`)
  const manifestFile = files.find(file => file.name === 'package.json')
  if (manifestFile && /"workspace:/.test(manifestFile.bytes.toString('utf8'))) problems.push('package.json: 含 workspace: 依赖，无法在独立仓库安装')
  if (problems.length) throw new Error(`导出被拒绝：\n- ${problems.join('\n- ')}`)

  await rm(out, { recursive: true, force: true })
  const records = []
  for (const { name, bytes } of files) {
    const target = resolve(out, name)
    await mkdir(dirname(target), { recursive: true })
    await cp(resolve(source, name), target) // byte-for-byte; mtime is deliberately not part of the contract
    records.push(`${createHash('sha256').update(bytes).digest('hex')}  ${name}`)
  }
  return { count: files.length, treeSha256: createHash('sha256').update(records.join('\n') + '\n').digest('hex'), records }
}

function sourceState() {
  return {
    head: git('rev-parse', 'HEAD').trim(),
    dirty: git('status', '--porcelain', '--', sourceRel).trim().length > 0,
  }
}

if (args.includes('--check')) {
  // Determinism: two independent exports of the same working tree must have the same tree hash.
  const a = resolve(tmpdir(), `unipass-export-check-a-${process.pid}`)
  const b = resolve(tmpdir(), `unipass-export-check-b-${process.pid}`)
  try {
    const first = await exportTree(safeOutputDirectory(a))
    const second = await exportTree(safeOutputDirectory(b))
    if (first.treeSha256 !== second.treeSha256) throw new Error('两次导出的树哈希不同，导出不具确定性。')
    console.log(`UniPass 导出确定性检查通过：${first.count} 个文件，tree sha256 ${first.treeSha256}`)
  } finally {
    await rm(a, { recursive: true, force: true })
    await rm(b, { recursive: true, force: true })
  }
} else {
  const out = safeOutputDirectory(resolve(option('--out') ?? defaultOut))
  const state = sourceState()
  if (args.includes('--strict') && state.dirty) throw new Error('packages/unipass 存在未提交修改；--strict 要求从已提交状态导出。')
  const result = await exportTree(out)
  // Sidecar manifest lives beside the tree so the standalone repository stays free of uNAS metadata.
  const manifestPath = `${out}.manifest.json`
  await writeFile(manifestPath, JSON.stringify({
    schemaVersion: 1,
    direction: 'uNAS packages/unipass -> UniPass distribution repository (one-way, never pushed by this script)',
    sourcePath: sourceRel,
    sourceHead: state.head,
    sourceDirty: state.dirty,
    fileCount: result.count,
    treeSha256: result.treeSha256,
    files: result.records.map(line => { const [sha256, ...path] = line.split('  '); return { path: path.join('  '), sha256 } }),
  }, null, 2) + '\n')
  console.log(`已导出 ${result.count} 个文件到 ${relative(process.cwd(), out) || '.'}${sep}（tree sha256 ${result.treeSha256}）`)
  console.log(`清单：${relative(process.cwd(), manifestPath)}；未联网，未推送。${state.dirty ? ' 注意：源码有未提交修改。' : ''}`)
}
