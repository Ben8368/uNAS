export type MarkdownInlineToken =
  | { kind: 'text' | 'code' | 'strong' | 'em'; text: string }
  | { kind: 'link'; text: string; href: string }

export class MarkdownLimitError extends Error {}
export const MARKDOWN_LIMITS = Object.freeze({ maxCharacters: 256 * 1024, maxBlocks: 1024, maxNodes: 8192 })

/** Each delimiter search advances monotonically, including unmatched openers. */
export function markdownInlineTokens(text: string, budget: { remaining: number } = { remaining: MARKDOWN_LIMITS.maxNodes }): MarkdownInlineToken[] {
  const next = new Map<string, number>()
  const closing = (delimiter: string, from: number) => {
    let index = next.get(delimiter)
    if (index === undefined || (index >= 0 && index < from)) {
      index = text.indexOf(delimiter, from)
      next.set(delimiter, index)
    }
    return index
  }
  const tokens: MarkdownInlineToken[] = []
  const append = (token: MarkdownInlineToken) => {
    if (--budget.remaining < 0) throw new MarkdownLimitError()
    tokens.push(token)
  }
  let plainStart = 0
  for (let cursor = 0; cursor < text.length;) {
    let token: MarkdownInlineToken | undefined
    let end = cursor
    const char = text[cursor]
    if (char === '[') {
      const labelEnd = closing(']', cursor + 1)
      if (labelEnd > cursor + 1 && text[labelEnd + 1] === '(') {
        const hrefEnd = closing(')', labelEnd + 2)
        if (hrefEnd > labelEnd + 2) {
          token = { kind: 'link', text: text.slice(cursor + 1, labelEnd), href: text.slice(labelEnd + 2, hrefEnd) }
          end = hrefEnd + 1
        }
      }
    } else if (char === '`') {
      const codeEnd = closing('`', cursor + 1)
      if (codeEnd > cursor + 1) { token = { kind: 'code', text: text.slice(cursor + 1, codeEnd) }; end = codeEnd + 1 }
    } else if (char === '*') {
      const strong = text[cursor + 1] === '*'
      const start = cursor + (strong ? 2 : 1)
      const emphasisEnd = closing('*', start)
      if (emphasisEnd > start && (!strong || text[emphasisEnd + 1] === '*')) {
        token = { kind: strong ? 'strong' : 'em', text: text.slice(start, emphasisEnd) }
        end = emphasisEnd + (strong ? 2 : 1)
      }
    }
    if (!token) { cursor += 1; continue }
    if (cursor > plainStart) append({ kind: 'text', text: text.slice(plainStart, cursor) })
    append(token)
    cursor = end
    plainStart = end
  }
  if (plainStart < text.length) append({ kind: 'text', text: text.slice(plainStart) })
  return tokens
}
