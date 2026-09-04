import { createRequire } from 'node:module'
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { createHash } from 'node:crypto'
const root = resolve(import.meta.dirname, '..')
const packageFile = resolve(root, 'apps/extension/package.json')
const target = resolve(root, 'assets/dependency-inventory.json')
const pkg = JSON.parse(await readFile(packageFile, 'utf8'))
const records = new Map()
async function visit(name, parent, scope) {
  const request = createRequire(parent)
  let manifest
  try { manifest = request.resolve(`${name}/package.json`) }
  catch {
    let directory = dirname(request.resolve(name))
    for (;;) {
      try {
        const candidate = resolve(directory, 'package.json')
        if (JSON.parse(await readFile(candidate, 'utf8')).name === name) { manifest = candidate; break }
      } catch {}
      const next = dirname(directory)
      if (next === directory) throw new Error(`Cannot resolve package metadata for ${name}`)
      directory = next
    }
  }
  const data = JSON.parse(await readFile(manifest, 'utf8'))
  const key = `${data.name}@${data.version}`
  if (records.has(key)) return
  const licenseFiles = []
  for (const file of (await readdir(dirname(manifest))).filter(file => /^(licen[cs]e|copying|notice)(\.|$)/i.test(file)).sort()) {
    const contents = await readFile(resolve(dirname(manifest), file))
    licenseFiles.push({ file, sha256: createHash('sha256').update(contents).digest('hex') })
  }
  records.set(key, { name: data.name, version: data.version, scope, declaredLicense: data.license ?? 'not-declared', licenseFiles, repository: typeof data.repository === 'object' ? data.repository.url : data.repository ?? null })
  if (scope === 'runtime-declared') for (const dependency of Object.keys(data.dependencies ?? {}).sort()) await visit(dependency, manifest, scope)
}
for (const name of Object.keys(pkg.dependencies).sort()) await visit(name, packageFile, 'runtime-declared')
for (const name of Object.keys(pkg.devDependencies).sort()) await visit(name, packageFile, 'direct-build-test-tool')
const result = JSON.stringify({
  schemaVersion: 1,
  scope: 'Installed declared runtime dependency graph plus direct build/test tools. Dev transitive dependencies and public distribution approval are not certified.',
  records: [...records.values()].sort((a, b) => a.name.localeCompare(b.name)),
}, null, 2) + '\n'
if (process.argv.includes('--check')) {
  if (await readFile(target, 'utf8') !== result) throw new Error('依赖清单已过期；重新运行 node scripts/dependency-inventory.mjs 后审查差异。')
  console.log(`依赖来源清单一致: ${records.size} packages（不代表公开分发已批准）。`)
} else {
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, result)
  console.log(`Recorded ${records.size} installed dependency identities and license hashes.`)
}
