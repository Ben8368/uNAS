import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { MarkdownSafeView } from './MarkdownSafeView'
import { markdownInlineTokens, MARKDOWN_LIMITS, MarkdownLimitError } from './markdownInline'

describe('bounded Markdown parsing', () => {
  it('scans unmatched brackets once and still recognizes later emphasis', () => {
    const source = '['.repeat(40_000) + ' **bold** `code`'
    const search = vi.spyOn(String.prototype, 'indexOf')
    const tokens = markdownInlineTokens(source)
    const searches = search.mock.calls.length
    search.mockRestore()
    expect(searches).toBeLessThan(10)
    expect(tokens.filter(token => token.kind !== 'text')).toEqual([{ kind: 'strong', text: 'bold' }, { kind: 'code', text: 'code' }])
    expect(tokens[0].text).toBe('['.repeat(40_000) + ' ')
  })

  it('renders the supported subset while keeping raw HTML and script links inert', () => {
    const markup = renderToStaticMarkup(<MarkdownSafeView source={'# Title\n\n**bold** *em* `code` [web](https://example.test/) [unsafe](javascript:alert)\n\n<script>bad</script>'} />)
    expect(markup).toContain('<h1>Title</h1>')
    expect(markup).toContain('<strong>bold</strong>')
    expect(markup).toContain('<em>em</em>')
    expect(markup).toContain('<code>code</code>')
    expect(markup).toContain('href="https://example.test/"')
    expect(markup).not.toContain('href="javascript:')
    expect(markup).not.toContain('<script>')
    expect(markup).toContain('&lt;script&gt;bad&lt;/script&gt;')
  })

  it('preserves oversized and highly structured documents as plain text', () => {
    for (const source of ['['.repeat(2 * 1024 * 1024), '# title\n'.repeat(MARKDOWN_LIMITS.maxBlocks + 1), '*x*'.repeat(MARKDOWN_LIMITS.maxNodes + 1)]) {
      const markup = renderToStaticMarkup(<MarkdownSafeView source={source} />)
      expect(markup).toContain('已按纯文本显示')
      expect(markup).toContain(`<pre>${source}</pre>`)
    }
    expect(() => markdownInlineTokens('*a* *b*', { remaining: 1 })).toThrow(MarkdownLimitError)
  })
})
