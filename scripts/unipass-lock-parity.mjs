// pnpm-lock.yaml is the monorepo install source of truth. packages/unipass/package-lock.json exists only so the
// exported standalone repository can run `npm ci` / `npm audit`. This check fails when their direct dependencies drift.
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const packageDirectory = resolve(root, 'packages/unipass')
const manifest = JSON.parse(await readFile(resolve(packageDirectory, 'package.json'), 'utf8'))
const npmLock = JSON.parse(await readFile(resolve(packageDirectory, 'package-lock.json'), 'utf8'))
const pnpmLock = await readFile(resolve(root, 'pnpm-lock.yaml'), 'utf8')

// Extract the `packages/unipass:` importer block without a YAML dependency.
const importer = pnpmLock.match(/^ {2}packages\/unipass:\n((?: {4,}.*\n|\n)*)/m)?.[1]
if (!importer) throw new Error('pnpm-lock.yaml 缺少 packages/unipass importer；请运行 pnpm install。')

const errors = []
const declared = { ...manifest.dependencies, ...manifest.devDependencies }
for (const [name, range] of Object.entries(declared).sort(([a], [b]) => a.localeCompare(b))) {
  const npmVersion = npmLock.packages?.[`node_modules/${name}`]?.version
  const rootDeclared = npmLock.packages?.['']?.devDependencies?.[name] ?? npmLock.packages?.['']?.dependencies?.[name]
  const block = importer.match(new RegExp(`^ {6}'?${name.replace(/[/@]/g, m => `\\${m}`)}'?:\\n {8}specifier: (.+)\\n {8}version: (.+)\\n`, 'm'))
  if (!npmVersion) errors.push(`${name}: package-lock.json 缺少解析版本`)
  if (rootDeclared !== range) errors.push(`${name}: package-lock.json 声明 ${rootDeclared ?? '无'}，package.json 声明 ${range}`)
  if (!block) { errors.push(`${name}: pnpm-lock.yaml importer 缺少该依赖`); continue }
  const [, specifier, resolved] = block
  if (specifier.trim() !== range) errors.push(`${name}: pnpm-lock.yaml specifier ${specifier.trim()} 与 package.json ${range} 不同`)
  const pnpmVersion = resolved.trim().replace(/\(.*$/, '')
  if (npmVersion && pnpmVersion !== npmVersion) errors.push(`${name}: pnpm 解析 ${pnpmVersion}，package-lock.json 解析 ${npmVersion}`)
}

if (errors.length) {
  console.error('UniPass lockfile 一致性检查失败（pnpm-lock.yaml 为准；用 npm install --package-lock-only 重新生成独立 lock）：')
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
} else {
  console.log(`UniPass 直接依赖在 pnpm-lock.yaml 与 package-lock.json 间一致：${Object.keys(declared).length} 项。`)
}
