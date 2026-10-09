// apps/extension/public/credential-core.wasm is a derived runtime artifact of packages/unipass/credential-core.
// Default: the tracked artifact must match its assets/demo-assets.json record (no toolchain needed).
// --rebuild: also rebuild from source with the pinned toolchain and require a byte-for-byte match.
// --write: Linux only. Rebuild with the pinned toolchain, then write the artifact and its demo-assets.json record.
//   rustc embeds host source paths (panic locations) in the data section, so Windows and Linux builds differ
//   by path separators only; the Linux pipeline that CI runs is the canonical producer of the tracked bytes.
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = resolve(import.meta.dirname, '..')
const artifactPath = 'apps/extension/public/credential-core.wasm'
const manifestPath = resolve(root, 'assets/demo-assets.json')
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')

async function rebuild() {
  const { buildCredentialCore } = await import(pathToFileURL(resolve(root, 'packages/unipass/scripts/build-wasm.mjs')).href)
  return await readFile(await buildCredentialCore())
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const record = manifest.assets?.find?.(item => item.path === artifactPath) ?? manifest.records?.find?.(item => item.path === artifactPath)
if (!record) throw new Error(`assets/demo-assets.json 缺少 ${artifactPath} 的登记`)

if (process.argv.includes('--write')) {
  if (process.platform !== 'linux') throw new Error('--write 只能在 Linux 上运行：已跟踪产物以 Linux CI 管线为准，其他宿主会把不同的路径分隔符写进 WASM。')
  const built = await rebuild()
  const before = { bytes: record.bytes, sha256: record.sha256 }
  await writeFile(resolve(root, artifactPath), built)
  record.bytes = built.byteLength
  record.sha256 = sha256(built)
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`credential-core.wasm 已按固定工具链重建并写入：${before.bytes} B ${before.sha256} -> ${record.bytes} B ${record.sha256}`)
  process.exit(0)
}

const tracked = await readFile(resolve(root, artifactPath))
const errors = []
if (record.sha256 !== sha256(tracked)) errors.push(`已跟踪产物哈希 ${sha256(tracked)} 与 demo-assets.json 登记 ${record.sha256} 不一致`)
if (record.bytes !== tracked.byteLength) errors.push(`已跟踪产物大小 ${tracked.byteLength} 与登记 ${record.bytes} 不一致`)

if (process.argv.includes('--rebuild')) {
  const built = await rebuild()
  if (sha256(built) !== sha256(tracked)) {
    errors.push(`从 packages/unipass/credential-core 重建的 WASM（${sha256(built)}）与已跟踪产物不同；请更新 ${artifactPath} 与 demo-assets.json，或回退源码改动`)
    // Diagnostic only: never relaxes the check. Same length but different bytes usually means host path separators.
    if (built.byteLength === tracked.byteLength) {
      let differing = 0
      for (let i = 0; i < built.byteLength; i++) if (built[i] !== tracked[i]) differing++
      errors.push(`两者长度相同、${differing} 个字节不同；若不同字节只是 0x5c 与 0x2f，说明已跟踪产物由不同宿主系统构建（Rust 会把宿主源码路径写进 data 段）。请用 Linux 管线 \`node scripts/credential-core-provenance.mjs --write\` 重新生成。`)
    }
  }
}

if (errors.length) {
  console.error('credential-core.wasm 出处检查失败：')
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
} else {
  console.log(`credential-core.wasm 出处检查通过（${process.argv.includes('--rebuild') ? '含源码重建，逐字节一致' : '登记一致；未重建'}）：sha256 ${sha256(tracked)}`)
}
