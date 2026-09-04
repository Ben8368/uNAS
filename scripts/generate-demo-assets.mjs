import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

// Original geometric artwork for this repository. Re-running yields identical bytes.
const root = resolve(import.meta.dirname, '..')
const base = 'apps/extension/public/static/app/icons/default'
const shapes = {
  browser: ['#3975a8', '<circle cx="32" cy="32" r="17"/><path d="M15 32h34M32 15c-12 10-12 24 0 34 12-10 12-24 0-34Z"/>'],
  download: ['#437a66', '<path d="M32 14v25m-10-9 10 10 10-10M16 42v7h32v-7"/>'],
  files: ['#487d9d', '<path d="M13 23h15l5 5h18v20H13ZM13 23v-5h16l5 5h17v5"/>'],
  media: ['#7774a8', '<rect x="13" y="16" width="38" height="32" rx="5"/><path d="m27 24 13 8-13 8Z"/>'],
  layers: ['#497493', '<path d="m12 24 20-11 20 11-20 11Zm0 10 20 11 20-11M12 44l20 11 20-11"/>'],
  settings: ['#64748b', '<path d="M15 20h34M15 32h34M15 44h34"/><circle cx="25" cy="20" r="4"/><circle cx="41" cy="32" r="4"/><circle cx="29" cy="44" r="4"/>'],
  logs: ['#64798f', '<path d="M17 13h30v38H17ZM23 23h18M23 32h18M23 41h12"/>'],
  image: ['#548774', '<rect x="13" y="15" width="38" height="34" rx="4"/><circle cx="24" cy="26" r="4"/><path d="m15 45 12-12 7 7 7-11 9 13"/>'],
  document: ['#a86763', '<path d="M18 12h20l10 10v30H18ZM38 12v12h10M25 33h16M25 41h12"/>'],
  archive: ['#a28755', '<rect x="14" y="15" width="36" height="36" rx="4"/><path d="M14 24h36M29 28h6v8h-6ZM29 41h6"/>'],
  tasks: ['#557eaa', '<path d="m14 21 4 4 7-9m-11 20 4 4 7-9M32 22h18M32 37h18M14 49h36"/>'],
}
await mkdir(resolve(root, base), { recursive: true })
const records = []
for (const [name, [color, shape]] of Object.entries(shapes)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect x="2" y="2" width="60" height="60" rx="15" fill="${color}"/><g fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${shape}</g></svg>\n`
  const file = `${base}/${name}.svg`
  await writeFile(resolve(root, file), svg)
  records.push({ path: file, bytes: Buffer.byteLength(svg), sha256: createHash('sha256').update(svg).digest('hex'), width: 64, height: 64 })
}
const favicon = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#246885"/><path d="M18 18v20a14 14 0 0 0 28 0V18" fill="none" stroke="white" stroke-width="7" stroke-linecap="round"/></svg>\n'
await writeFile(resolve(root, 'apps/extension/public/favicon.svg'), favicon)
records.push({ path: 'apps/extension/public/favicon.svg', bytes: Buffer.byteLength(favicon), sha256: createHash('sha256').update(favicon).digest('hex'), width: 64, height: 64 })
const appearance = await readFile(resolve(root, 'apps/extension/src/appearance.ts'))
records.push({ path: 'apps/extension/src/appearance.ts', bytes: appearance.length, sha256: createHash('sha256').update(appearance).digest('hex'), kind: 'procedural-css-no-bitmap' })
await mkdir(resolve(root, 'assets'), { recursive: true })
await writeFile(resolve(root, 'assets/demo-assets.json'), JSON.stringify({
  schemaVersion: 1, provenance: 'Original geometric SVG and CSS authored in this repository on 2026-09-04; no third-party source images.',
  generator: 'scripts/generate-demo-assets.mjs', license: 'Repository license not yet selected by maintainer; local development only. No third-party license is claimed.',
  publicDistributionApproved: false, assets: records,
}, null, 2) + '\n')
console.log(`Generated ${records.length} original asset records.`)
