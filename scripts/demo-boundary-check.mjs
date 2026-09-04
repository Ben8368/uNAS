import { readdir, readFile } from 'node:fs/promises'
import { resolve, relative } from 'node:path'
const root = resolve(import.meta.dirname, '..')
const source = resolve(root, 'apps/extension/src')
const failures = []
async function visit(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, item.name)
    if (item.isDirectory()) {
      if (path !== resolve(source, 'api/real')) await visit(path)
      continue
    }
    if (!/\.tsx?$/.test(item.name) || /\.(test|spec)\.tsx?$/.test(item.name)) continue
    const text = await readFile(path, 'utf8')
    const rules = [
      [/\b(?:from|import)\s*\(?\s*['"][^'"]*api\/real(?:[/'"])/, 'Demo 不得导入 real adapter'],
      [/type\s*=\s*['"]file['"]/, 'Demo 不得接收真实文件选择'],
      [/window\.unasDesktop|globalThis\.unasDesktop/, 'Demo 不得调用桌面 bridge'],
      [/\b(?:showOpenFilePicker|showDirectoryPicker|showSaveFilePicker)\s*\(/, 'Demo 不得请求真实文件授权'],
      [/\bnew\s+FileReader\s*\(/, 'Demo 不得读取真实文件'],
    ]
    for (const [pattern, reason] of rules) if (pattern.test(text)) failures.push(`${relative(root, path)}: ${reason}`)
  }
}
await visit(source)
const demoFiles = [resolve(source, 'api/demo.ts'), ...await readdir(resolve(source, 'api/demo')).then(files => files.filter(file => file.endsWith('.ts') && !file.includes('.test.')).map(file => resolve(source, 'api/demo', file)))]
for (const file of demoFiles) if (/Date\.now\(|Math\.random\(|new Date\(\)/.test(await readFile(file, 'utf8'))) failures.push(`${relative(root, file)}: mock 时钟与 ID 必须确定性`)
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1 }
else console.log('Demo 源码边界检查通过（静态回归门禁，不替代运行时权限验收）。')
