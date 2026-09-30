import { Fragment, type ReactNode } from 'react'

const INLINE_TOKEN = /(\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g

function safeHref(value: string): string | undefined {
  try {
    const url = new URL(value)
    if (url.protocol === 'https:' || url.protocol === 'http:' || url.protocol === 'mailto:') return url.href
  } catch {
    // Relative and malformed links remain inert text.
  }
  return undefined
}

function inlineNodes(text: string): ReactNode[] {
  const result: ReactNode[] = []
  let cursor = 0
  let index = 0
  for (const match of text.matchAll(INLINE_TOKEN)) {
    const token = match[0]
    const start = match.index ?? 0
    if (start > cursor) result.push(text.slice(cursor, start))
    let node: ReactNode
    if (token.startsWith('`')) node = <code key={index}>{token.slice(1, -1)}</code>
    else if (token.startsWith('**')) node = <strong key={index}>{token.slice(2, -2)}</strong>
    else if (token.startsWith('*')) node = <em key={index}>{token.slice(1, -1)}</em>
    else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      const href = link ? safeHref(link[2]) : undefined
      node = link && href
        ? <a key={index} href={href} target="_blank" rel="noopener noreferrer">{link[1]}</a>
        : (link?.[1] ?? token)
    }
    result.push(node)
    cursor = start + token.length
    index += 1
  }
  if (cursor < text.length) result.push(text.slice(cursor))
  return result
}

type Block = { type: 'paragraph' | 'heading' | 'quote' | 'code' | 'list'; text: string; level?: number; ordered?: boolean }

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  for (let i = 0; i < lines.length;) {
    const line = lines[i]
    if (!line.trim()) { i += 1; continue }
    const fence = line.match(/^\s*```/)
    if (fence) {
      const code: string[] = []
      i += 1
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++])
      if (i < lines.length) i += 1
      blocks.push({ type: 'code', text: code.join('\n') })
      continue
    }
    const heading = line.match(/^\s*(#{1,6})\s+(.+)$/)
    if (heading) { blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] }); i += 1; continue }
    if (/^\s*>/.test(line)) { blocks.push({ type: 'quote', text: line.replace(/^\s*>\s?/, '') }); i += 1; continue }
    const list = line.match(/^\s*((?:[-+*])|(?:\d+\.))\s+(.+)$/)
    if (list) {
      const ordered = /^\d/.test(list[1])
      const items: string[] = []
      while (i < lines.length) {
        const item = lines[i].match(/^\s*((?:[-+*])|(?:\d+\.))\s+(.+)$/)
        if (!item || /^\d/.test(item[1]) !== ordered) break
        items.push(item[2]); i += 1
      }
      blocks.push({ type: 'list', text: items.join('\n'), ordered })
      continue
    }
    const paragraph = [line]
    i += 1
    while (i < lines.length && lines[i].trim() && !/^\s*(?:#{1,6}\s|>|```|(?:[-+*]|\d+\.)\s)/.test(lines[i])) paragraph.push(lines[i++])
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') })
  }
  return blocks
}

/** Small safe Markdown subset. Raw HTML, images and embedded content are displayed as text. */
export function MarkdownSafeView({ source }: { source: string }) {
  return <div className="fm-preview-markdown">
    {parseBlocks(source).map((block, index) => {
      if (block.type === 'heading') {
        const Tag = `h${block.level}` as keyof JSX.IntrinsicElements
        return <Tag key={index}>{inlineNodes(block.text)}</Tag>
      }
      if (block.type === 'quote') return <blockquote key={index}>{inlineNodes(block.text)}</blockquote>
      if (block.type === 'code') return <pre key={index}><code>{block.text}</code></pre>
      if (block.type === 'list') {
        const Tag = block.ordered ? 'ol' : 'ul'
        return <Tag key={index}>{block.text.split('\n').map((item, itemIndex) => <li key={itemIndex}>{inlineNodes(item)}</li>)}</Tag>
      }
      return <p key={index}>{inlineNodes(block.text).map((node, nodeIndex) => <Fragment key={nodeIndex}>{node}</Fragment>)}</p>
    })}
  </div>
}

export function markdownLinkTarget(value: string): string | undefined { return safeHref(value) }
