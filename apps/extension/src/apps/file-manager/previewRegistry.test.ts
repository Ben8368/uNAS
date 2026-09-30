import { describe, expect, it } from 'vitest'
import { detectPreview, PREVIEW_READ_LIMITS } from 'unas-src/apps/file-manager/previewRegistry'
import { markdownLinkTarget } from 'unas-src/apps/file-manager/MarkdownSafeView'

describe('preview registry', () => {
  it('recognizes raster images from signatures rather than names alone', () => {
    expect(detectPreview(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), { name: 'renamed.bin' }))
      .toMatchObject({ kind: 'image', mediaType: 'image/png' })
    expect(detectPreview(new Uint8Array([1, 2, 3, 4]), { name: 'photo.png', declaredType: 'image/png' }).kind).toBe('unsupported')
  })

  it('recognizes bounded UTF-8 text and Markdown using hints', () => {
    expect(detectPreview(new TextEncoder().encode('# hello'), { name: 'readme.md' }).kind).toBe('markdown')
    expect(detectPreview(new TextEncoder().encode('{"ok":true}'), { name: 'data.json', declaredType: 'application/json' }).kind).toBe('text')
    expect(PREVIEW_READ_LIMITS.textBytes).toBeLessThanOrEqual(2 * 1024 * 1024)
  })

  it('keeps active and unsupported document formats out of the viewer', () => {
    expect(detectPreview(new TextEncoder().encode('<script>'), { name: 'x.html', declaredType: 'text/html' })).toMatchObject({ kind: 'unsupported' })
    expect(detectPreview(new TextEncoder().encode('%PDF-1.7'), { name: 'x.bin' }).kind).toBe('unsupported')
  })
})

describe('safe Markdown link policy', () => {
  it('allows explicit web/mail links and rejects script or relative URLs', () => {
    expect(markdownLinkTarget('https://example.com/a')).toBe('https://example.com/a')
    expect(markdownLinkTarget('mailto:test@example.com')).toBe('mailto:test@example.com')
    expect(markdownLinkTarget('javascript:alert(1)')).toBeUndefined()
    expect(markdownLinkTarget('/relative')).toBeUndefined()
  })
})
