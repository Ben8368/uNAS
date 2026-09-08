import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, extname, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const budgets = [
  { file: 'AGENTS.md', lines: 85, characters: 5200 },
  { file: 'CONTEXT.md', lines: 45, characters: 3000 },
  { file: 'LESSONS.md', lines: 20, characters: 1800 },
  { file: 'CLAUDE.md', lines: 12, characters: 800 },
  { file: '.cursorrules', lines: 12, characters: 800 }
]

const errors = []
const contents = new Map()

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function listMarkdown(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (['.git', 'node_modules'].includes(entry.name)) continue
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) files.push(...await listMarkdown(path))
    else if (extname(entry.name).toLowerCase() === '.md') files.push(path)
  }
  return files
}

for (const budget of budgets) {
  const path = resolve(root, budget.file)
  try {
    const content = await readFile(path, 'utf8')
    contents.set(budget.file, content)
    const lines = content.trimEnd().split(/\r?\n/).length
    const characters = [...content].length
    if (lines > budget.lines || characters > budget.characters) {
      errors.push(`${budget.file}: ${lines}/${budget.lines} 行，${characters}/${budget.characters} 字符`)
    }
  } catch {
    errors.push(`缺少强制加载文件：${budget.file}`)
  }
}

const context = contents.get('CONTEXT.md') ?? ''
// 当前阶段只由 Context 维护；历史阶段、Roadmap Gate 和规则不受此检查影响。
const phase = context.match(/\*\*阶段：\*\*\s*Phase\s+(\d+)/)?.[1]
for (const file of ['README.md', 'SECURITY.md']) {
  const text = await readFile(resolve(root, file), 'utf8')
  const claims = [...text.matchAll(/(?:当前处于|仍处于|项目处于)\s*\*{0,2}Phase\s+(\d+)/g)]
  for (const claim of claims) {
    if (claim[1] !== phase) errors.push(`${file}: 当前阶段与 CONTEXT.md 不一致，请改为引用唯一事实源`)
  }
}
const prioritySection = context.match(/## 近期优先级\s+([\s\S]*?)(?=\n## |$)/)?.[1] ?? ''
const priorities = [...prioritySection.matchAll(/^\d+\. /gm)].length
if (priorities > 3) errors.push(`CONTEXT.md: 近期优先级不得超过 3 项，当前为 ${priorities} 项`)
if (/\bSP-\d{2}\b/.test(prioritySection) && !/\[[^\]]*SP-\d{2}[^\]]*\]\([^)]*benchmarks\/sp-\d{2}\/README\.md\)/i.test(prioritySection)) {
  errors.push('CONTEXT.md: 提到 SP-xx 的优先级必须链接对应 benchmarks/<probe>/README.md')
}

const verificationSection = context.match(/## 最近验证\s+([\s\S]*?)(?=\n## |$)/)?.[1] ?? ''
for (const item of verificationSection.split(/\r?\n/).filter((line) => line.startsWith('- '))) {
  if (!/\[[^\]]+\]\([^)]+\)/.test(item)) errors.push('CONTEXT.md: 每条最近验证必须包含指向证据的 Markdown 链接')
}

for (const forbidden of ['当前分支', '## 常用命令', '## 常用文档', '完整变更历史']) {
  if (context.includes(forbidden)) errors.push(`CONTEXT.md: 不应包含“${forbidden}”`)
}

const requiredSections = {
  'AGENTS.md': ['## 开局与按需读取', '## 不可跨越的边界', '## 治理文档自治理', 'docs/GOVERNANCE.md'],
  'CONTEXT.md': ['## 当前决策', '## 近期优先级', '## 最近验证', '## 按需入口'],
  'LESSONS.md': [
    'docs/lessons/governance.md',
    'docs/lessons/architecture.md',
    'docs/lessons/browser.md',
    'docs/lessons/windows.md'
  ]
}

for (const [file, sections] of Object.entries(requiredSections)) {
  const content = contents.get(file) ?? ''
  for (const section of sections) {
    if (!content.includes(section)) errors.push(`${file}: 缺少必需路由或章节“${section}”`)
  }
}

const routedTargets = [
  'docs/GOVERNANCE.md',
  'docs/AI_RULES.md',
  'docs/PRODUCT.md',
  'docs/FRONTEND_GUIDE.md',
  'docs/DESIGN_SYSTEM.md',
  'docs/APP_CONTRACT.md',
  'docs/ARCHITECTURE.md',
  'docs/ENGINE_CONTRACT.md',
  'docs/ROADMAP.md',
  'docs/DEVELOPMENT_BLUEPRINT.md',
  'docs/QUALITY.md',
  'docs/RISK_REGISTER.md',
  'docs/TECH_DEBT.md',
  'docs/MAINTAINERS.md',
  'docs/ADR/README.md'
]

for (const file of routedTargets) {
  if (!await exists(resolve(root, file))) errors.push(`缺少路由目标：${file}`)
}

for (const file of await listMarkdown(root)) {
  const content = await readFile(file, 'utf8')
  const links = [...content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)].map((match) => match[1])
  for (const rawLink of links) {
    const link = rawLink.trim().replace(/^<|>$/g, '')
    if (/^(https?:|mailto:|#)/i.test(link)) continue
    const target = decodeURIComponent(link.split('#')[0])
    if (!target) continue
    if (!await exists(resolve(dirname(file), target))) {
      errors.push(`${file.slice(root.length + 1)}: 失效相对链接 ${rawLink}`)
    }
  }
}

const adrDirectory = resolve(root, 'docs', 'ADR')
for (const entry of await readdir(adrDirectory, { withFileTypes: true })) {
  if (!entry.isFile() || !/^\d{4}-.+\.md$/.test(entry.name)) continue
  const content = await readFile(resolve(adrDirectory, entry.name), 'utf8')
  if (!/^- 状态：(提议|已接受|已替代|已拒绝)$/m.test(content)) {
    errors.push(`docs/ADR/${entry.name}: 缺少合法状态`)
  }
  if (!/^- 日期：\d{4}-\d{2}-\d{2}$/m.test(content)) {
    errors.push(`docs/ADR/${entry.name}: 缺少 ISO 日期`)
  }
}

if (errors.length > 0) {
  console.error('治理文档检查失败：')
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
} else {
  console.log('治理文档检查通过。')
}
