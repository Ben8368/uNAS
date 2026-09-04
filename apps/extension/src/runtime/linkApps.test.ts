import { describe, expect, it } from 'vitest'
import { validateLink, validateLinkUrl, type LinkApp } from './linkApps'
describe('declarative Link App', () => {
  it('rejects privileged, insecure, malformed and credential-bearing URLs', () => {
    for (const url of ['http://example.com', 'javascript:alert(1)', 'data:text/html,test', 'file:///test', 'chrome://settings', 'chrome-extension://unas/workspace.html', 'about:blank', 'https://user:secret@example.com', 'https://exam\nple.com', 'example.com']) expect(validateLinkUrl(url)).toHaveProperty('error')
    expect(validateLinkUrl('https://example.com/path?a=1')).toEqual({ url: 'https://example.com/path?a=1' })
  })
  it('validates names and permits editing the same app', () => {
    const saved: LinkApp = { schemaVersion: 1, id: 'a', name: 'Example', url: 'https://example.com/', icon: 'globe' }
    expect(validateLink({ ...saved, name: 'example' }, [saved])).toContain('同名')
    expect(validateLink(saved, [saved], 'a')).toBeNull()
    expect(validateLink({ ...saved, name: '' }, [])).toContain('名称')
  })
})
