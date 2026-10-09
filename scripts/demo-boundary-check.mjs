import { readdir, readFile } from 'node:fs/promises'
import { dirname, resolve, relative, sep } from 'node:path'
const root = resolve(import.meta.dirname, '..')
const source = resolve(root, 'apps/extension/src')
const failures = []
const isRealDirectory = path => path.split(sep).at(-1) === 'real'
// A `real/` directory is private to the directory that contains it: its facade (a sibling file) may import it,
// nobody else may. Demo code therefore cannot reach a real adapter by any alias or relative path.
function realOwner(target) {
  const parts = relative(source, target).split(sep)
  const index = parts.indexOf('real')
  return index < 0 ? undefined : resolve(source, ...parts.slice(0, index))
}
function resolveSpecifier(specifier, from) {
  if (specifier.startsWith('unas-src/')) return resolve(source, specifier.slice('unas-src/'.length))
  if (specifier.startsWith('.')) return resolve(dirname(from), specifier.split('?')[0])
  return undefined
}
async function visit(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, item.name)
    if (item.isDirectory()) {
      if (!isRealDirectory(path)) await visit(path)
      continue
    }
    if (!/\.tsx?$/.test(item.name) || /\.(test|spec)\.tsx?$/.test(item.name)) continue
    const text = await readFile(path, 'utf8')
    for (const match of text.matchAll(/\b(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
      const target = resolveSpecifier(match[1], path)
      const owner = target && realOwner(target)
      if (owner && relative(owner, path).startsWith('..')) failures.push(`${relative(root, path)}: Demo 不得导入 real adapter（${match[1]} 属于 ${relative(source, owner)} 的私有 real/）`)
    }
    const rules = [
      [/type\s*=\s*['"]file['"]/, 'Demo 不得接收真实文件选择'],
      [/window\.unasDesktop|globalThis\.unasDesktop/, 'Demo 不得调用桌面 bridge'],
      [/\b(?:showOpenFilePicker|showDirectoryPicker|showSaveFilePicker)\s*\(/, 'Demo 不得请求真实文件授权'],
      [/\bnew\s+FileReader\s*\(/, 'Demo 不得读取真实文件'],
    ]
    for (const [pattern, reason] of rules) if (pattern.test(text)) failures.push(`${relative(root, path)}: ${reason}`)
  }
}
await visit(source)
const demoDirectory = resolve(source, 'platform/demo')
const demoFiles = (await readdir(demoDirectory)).filter(file => file.endsWith('.ts') && !file.includes('.test.')).map(file => resolve(demoDirectory, file))
if (demoFiles.length === 0) failures.push('platform/demo: 未找到 mock adapter 源码，确定性检查没有对象')
for (const file of demoFiles) if (/Date\.now\(|Math\.random\(|new Date\(\)/.test(await readFile(file, 'utf8'))) failures.push(`${relative(root, file)}: mock 时钟与 ID 必须确定性`)
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1 }
else console.log('Demo 源码边界检查通过（静态回归门禁，不替代运行时权限验收）。')
