import { describe, expect, it } from 'vitest'
import { davName, davPath } from './listing'

describe('WebDAV file path boundary', () => {
  it.each(['..', '.', 'a/b', 'a\\b', 'a%2fb', 'a?b', 'a:b', 'a#b', 'a\n'])('rejects unsafe file names: %s', name => {
    expect(() => davName(name)).toThrow()
  })
  it.each(['/outside/', '../', '%2e%2e/', 'dir/%2Foutside', 'dir//child/', 'https://other.example/'])('rejects unsafe paths: %s', path => {
    expect(() => davPath(path)).toThrow()
  })
  it('accepts encoded unicode names and endpoint-relative directories', () => {
    expect(davName('中文 文件.txt')).toBe('中文 文件.txt')
    expect(davPath('folder/%E4%B8%AD%E6%96%87/')).toBe('folder/%E4%B8%AD%E6%96%87/')
  })
})
