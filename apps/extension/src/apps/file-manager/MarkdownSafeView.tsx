import { Fragment, type ReactNode } from 'react'
import { markdownInlineTokens, MARKDOWN_LIMITS, MarkdownLimitError } from './markdownInline'

function safeHref(value: string): string | undefined {
  try {
    const url = new URL(value)
    if (url.protocol === 'https:' || url.protocol === 'http:' || url.protocol === 'mailto:') return url.href
  } catch {
    // Relative and malformed links remain inert text.
  }
  return undefined
}

function inlineNodes(text: string, budget: { remaining: number }): ReactNode[] {
  return markdownInlineTokens(text, budget).map((token, index) => {
    if (token.kind === 'code') return <code key={index}>{token.text}</code>
    if (token.kind === 'strong') return <strong key={index}>{token.text}</strong>
    if (token.kind === 'em') return <em key={index}>{token.text}</em>
    if (token.kind === 'link') {
      const href = safeHref(token.href)
      return href ? <a key={index} href={href} target="_blank" rel="noopener noreferrer">{token.text}</a> : token.text
    }
    return token.text
  })
}

type Block = { type: 'paragraph' | 'heading' | 'quote' | 'code' | 'list'; text: string; level?: number; ordered?: boolean }

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  for (let i = 0; i < lines.length;) {
    if (blocks.length >= MARKDOWN_LIMITS.maxBlocks) throw new MarkdownLimitError()
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
  const plain = () => <div className="fm-preview-markdown"><p role="status">Markdown 内容较大或结构较复杂，已按纯文本显示。</p><pre>{source}</pre></div>
  if (source.length > MARKDOWN_LIMITS.maxCharacters) return plain()
  const budget = { remaining: MARKDOWN_LIMITS.maxNodes }
  try { return <div className="fm-preview-markdown">
    {parseBlocks(source).map((block, index) => {
      if (--budget.remaining < 0) throw new MarkdownLimitError()
      if (block.type === 'heading') {
        const Tag = `h${block.level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
        return <Tag key={index}>{inlineNodes(block.text, budget)}</Tag>
      }
      if (block.type === 'quote') return <blockquote key={index}>{inlineNodes(block.text, budget)}</blockquote>
      if (block.type === 'code') return <pre key={index}><code>{block.text}</code></pre>
      if (block.type === 'list') {
        const Tag = block.ordered ? 'ol' : 'ul'
        return <Tag key={index}>{block.text.split('\n').map((item, itemIndex) => <li key={itemIndex}>{inlineNodes(item, budget)}</li>)}</Tag>
      }
      return <p key={index}>{inlineNodes(block.text, budget).map((node, nodeIndex) => <Fragment key={nodeIndex}>{node}</Fragment>)}</p>
    })}
  </div> } catch (error) { if (error instanceof MarkdownLimitError) return plain(); throw error }
}

export function markdownLinkTarget(value: string): string | undefined { return safeHref(value) }
