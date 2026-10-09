// apps/extension/public/credential-core.wasm is a derived runtime artifact of packages/unipass/credential-core.
// Default: the tracked artifact must match its assets/demo-assets.json record (no toolchain needed).
// --rebuild: also rebuild from source with the pinned toolchain and require a byte-for-byte match.
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = resolve(import.meta.dirname, '..')
const artifactPath = 'apps/extension/public/credential-core.wasm'
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')

const tracked = await readFile(resolve(root, artifactPath))
const record = JSON.parse(await readFile(resolve(root, 'assets/demo-assets.json'), 'utf8')).assets?.find?.(item => item.path === artifactPath)
  ?? JSON.parse(await readFile(resolve(root, 'assets/demo-assets.json'), 'utf8')).records?.find?.(item => item.path === artifactPath)
if (!record) throw new Error(`assets/demo-assets.json 缺少 ${artifactPath} 的登记`)
const errors = []
if (record.sha256 !== sha256(tracked)) errors.push(`已跟踪产物哈希 ${sha256(tracked)} 与 demo-assets.json 登记 ${record.sha256} 不一致`)
if (record.bytes !== tracked.byteLength) errors.push(`已跟踪产物大小 ${tracked.byteLength} 与登记 ${record.bytes} 不一致`)

if (process.argv.includes('--rebuild')) {
  const { buildCredentialCore } = await import(pathToFileURL(resolve(root, 'packages/unipass/scripts/build-wasm.mjs')).href)
  const built = await readFile(await buildCredentialCore())
  if (sha256(built) !== sha256(tracked)) errors.push(`从 packages/unipass/credential-core 重建的 WASM（${sha256(built)}）与已跟踪产物不同；请更新 ${artifactPath} 与 demo-assets.json，或回退源码改动`)
}

if (errors.length) {
  console.error('credential-core.wasm 出处检查失败：')
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
} else {
  console.log(`credential-core.wasm 出处检查通过（${process.argv.includes('--rebuild') ? '含源码重建，逐字节一致' : '登记一致；未重建'}）：sha256 ${sha256(tracked)}`)
}
