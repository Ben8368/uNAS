import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

// Unified App family: 64px rounded tile, opaque tonal gradient and white geometric glyph.
// Original geometric artwork for this repository. Re-running yields identical bytes.
const root = resolve(import.meta.dirname, '..')
const base = 'apps/extension/public/static/app/icons/default'
const assetManifestPath = resolve(root, 'assets/demo-assets.json')
const existingManifest = JSON.parse(await readFile(assetManifestPath, 'utf8'))
const shapes = {
  link: ['#7b8491', '#555d73', '<circle cx="32" cy="32" r="17"/><path d="M15 32h34M32 15c-12 10-12 24 0 34 12-10 12-24 0-34Z"/>'],
  browser: ['#81899a', '#5b6278', '<rect x="15" y="15" width="13" height="13" rx="3"/><rect x="36" y="15" width="13" height="13" rx="3"/><rect x="15" y="36" width="13" height="13" rx="3"/><path d="M36 42h14m-7-7v14"/>'],
  password: ['#8685a5', '#5c5c7d', '<rect x="18" y="28" width="28" height="23" rx="6" fill="#fff" fill-opacity=".12"/><path d="M23 28v-7a9 9 0 0 1 18 0v7"/><circle cx="32" cy="38" r="2.5"/><path d="M32 41v4"/>'],
  adblock: ['#6e9488', '#456d63', '<path d="M32 13 49 20v12c0 12-17 20-17 20S15 44 15 32V20Z" fill="#fff" fill-opacity=".12"/><path d="m23 32 6 6 13-14"/>'],
  download: ['#7c9a78', '#527153', '<path d="M32 14v25m-10-9 10 10 10-10"/><path d="M16 40v9h32v-9"/>'],
  files: ['#a68b62', '#785d3c', '<path d="M13 25v-7h15l6 6h17v6" stroke-opacity=".65"/><path d="M13 27h15l5 5h18l-3 17H16Z" fill="#fff" fill-opacity=".16"/>'],
  music: ['#a97888', '#7c5266', '<path d="M27 43V20l21-5v23M27 27l21-5"/><ellipse cx="21" cy="44" rx="6" ry="5" fill="#fff"/><ellipse cx="42" cy="39" rx="6" ry="5" fill="#fff"/>'],
  media: ['#9784a9', '#695878', '<rect x="13" y="16" width="38" height="32" rx="6"/><path d="m27 24 13 8-13 8Z" fill="#fff" fill-opacity=".2"/>'],
  layers: ['#7f88a7', '#5b6383', '<path d="m12 24 20-11 20 11-20 11Z" fill="#fff" fill-opacity=".16"/><path d="m12 34 20 11 20-11M12 44l20 11 20-11"/>'],
  settings: ['#88858e', '#62616f', '<path d="M15 20h34M15 32h34M15 44h34"/><circle cx="25" cy="20" r="4" fill="#70776a"/><circle cx="41" cy="32" r="4" fill="#70776a"/><circle cx="29" cy="44" r="4" fill="#70776a"/>'],
  logs: ['#8e8895', '#656170', '<rect x="16" y="13" width="32" height="38" rx="5"/><path d="m22 23 4 4-4 4M32 29h9M23 40h18"/>'],
  image: ['#7e977d', '#567052', '<rect x="13" y="15" width="38" height="34" rx="5"/><circle cx="24" cy="26" r="4"/><path d="m15 45 12-12 7 7 7-11 9 13"/>'],
  document: ['#b47e78', '#85514e', '<path d="M18 12h20l10 10v30H18ZM38 12v12h10M25 33h16M25 41h12"/>'],
  archive: ['#a39061', '#756032', '<rect x="14" y="15" width="36" height="36" rx="5"/><path d="M14 24h36M29 29h6v8h-6ZM29 43h6"/>'],
  tasks: ['#788da0', '#536978', '<path d="m14 21 4 4 7-9m-11 20 4 4 7-9M32 22h18M32 37h18M14 49h36"/>'],
  app: ['#88858e', '#62616f', '<rect x="16" y="16" width="12" height="12" rx="3"/><rect x="36" y="16" width="12" height="12" rx="3"/><rect x="16" y="36" width="12" height="12" rx="3"/><rect x="36" y="36" width="12" height="12" rx="3"/>'],
}
await mkdir(resolve(root, base), { recursive: true })
const records = []
for (const [name, [top, bottom, shape]] of Object.entries(shapes)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><defs><linearGradient id="tile" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(#tile)"/><rect x=".75" y=".75" width="62.5" height="62.5" rx="15.25" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width="1.5"/><g fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">${shape}</g></svg>\n`
  const file = `${base}/${name}.svg`
  await writeFile(resolve(root, file), svg)
  records.push({ path: file, bytes: Buffer.byteLength(svg), sha256: createHash('sha256').update(svg).digest('hex'), width: 64, height: 64 })
}
const appearance = await readFile(resolve(root, 'apps/extension/src/shared/appearance/appearance.ts'))
records.push({ path: 'apps/extension/src/shared/appearance/appearance.ts', bytes: appearance.length, sha256: createHash('sha256').update(appearance).digest('hex'), kind: 'procedural-css-no-bitmap' })
const startupAppearance = await readFile(resolve(root, 'apps/extension/public/startupAppearance.js'))
records.push({ path: 'apps/extension/public/startupAppearance.js', bytes: startupAppearance.length, sha256: createHash('sha256').update(startupAppearance).digest('hex'), kind: 'local-startup-prepaint-script' })
await mkdir(resolve(root, 'assets'), { recursive: true })
const generatedPaths = new Set(records.map(({ path }) => path))
const preservedRecords = existingManifest.assets.filter(({ path }) => !generatedPaths.has(path) && path !== 'apps/extension/public/favicon.svg' && path !== `${base}/music.png`)
await writeFile(resolve(root, 'assets/demo-assets.json'), JSON.stringify({
  schemaVersion: 1, provenance: 'Original geometric SVG and CSS authored in this repository; unified App icon family revised on 2026-11-03; extension and favicon icon PNGs are separately recorded with their source.',
  generator: 'scripts/generate-demo-assets.mjs', license: 'Repository license not yet selected by maintainer; local development only. No third-party license is claimed.',
  publicDistributionApproved: false, assets: [...records, ...preservedRecords],
}, null, 2) + '\n')
console.log(`Generated ${records.length} original asset records.`)
