import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { installGitHooks } from './install-git-hooks.mjs'

const root = resolve(import.meta.dirname, '..')
const codex = 'Co-authored-by: Codex <codex@openai.com>'
const cursor = 'Co-authored-by: Cursor <cursoragent@cursor.com>'
const claude = 'Co-authored-by: Claude Code <noreply@anthropic.com>'

test('Git attribution hooks use real commits in an isolated repository', async (t) => {
  mkdirSync(resolve(root, '.tmp'), { recursive: true })
  // Retain test-authored fixtures in ignored output, never touch real repository history.
  const fixture = mkdtempSync(resolve(root, '.tmp/git-hooks-'))
  const repo = resolve(fixture, 'repo with spaces 中文')
  mkdirSync(resolve(repo, '.githooks'), { recursive: true })
  copyFileSync(resolve(root, '.githooks/commit-msg'), resolve(repo, '.githooks/commit-msg'))
  const emptyConfig = resolve(fixture, 'empty-git-config')
  writeFileSync(emptyConfig, '')
  const previousGlobal = process.env.GIT_CONFIG_GLOBAL
  const previousSystem = process.env.GIT_CONFIG_NOSYSTEM
  process.env.GIT_CONFIG_GLOBAL = emptyConfig
  process.env.GIT_CONFIG_NOSYSTEM = '1'
  t.after(() => {
    if (previousGlobal === undefined) delete process.env.GIT_CONFIG_GLOBAL
    else process.env.GIT_CONFIG_GLOBAL = previousGlobal
    if (previousSystem === undefined) delete process.env.GIT_CONFIG_NOSYSTEM
    else process.env.GIT_CONFIG_NOSYSTEM = previousSystem
  })
  function git(args) {
    const result = spawnSync('git', ['-C', repo, ...args], {
      encoding: 'utf8', windowsHide: true, timeout: 10_000,
    })
    if (result.error) throw result.error
    return result
  }
  function checked(args) {
    const result = git(args)
    assert.equal(result.status, 0, result.stderr || result.stdout)
    return result.stdout.trimEnd()
  }
  checked(['init', '--quiet'])
  for (const [key, value] of [
    ['user.name', 'Hook Fixture'], ['user.email', 'fixture@example.invalid'],
    ['commit.gpgsign', 'false'], ['core.autocrlf', 'false'],
  ]) checked(['config', '--local', key, value])
  await t.test('existing hook configuration is preserved', () => {
    checked(['config', '--local', 'core.hooksPath', 'existing-hooks'])
    assert.throws(() => installGitHooks(repo), /Existing core.hooksPath is preserved/)
    assert.equal(checked(['config', '--local', '--get', 'core.hooksPath']), 'existing-hooks')
    checked(['config', '--local', '--unset', 'core.hooksPath'])
    const nativeHook = resolve(repo, '.git/hooks/pre-commit')
    const original = '#!/bin/sh\nexit 0\n'
    writeFileSync(nativeHook, original)
    assert.throws(() => installGitHooks(repo), /Existing hooks are preserved/)
    assert.equal(readFileSync(nativeHook, 'utf8'), original)
    // Delete only the exact fixture file created above, without recursive cleanup.
    unlinkSync(nativeHook)
  })
  await t.test('installation is idempotent and repository-local', () => {
    installGitHooks(repo)
    installGitHooks(repo)
    assert.equal(checked(['config', '--local', '--get', 'core.hooksPath']), '.githooks')
    assert.equal(readFileSync(emptyConfig, 'utf8'), '')
  })
  writeFileSync(resolve(repo, 'content.txt'), 'fixture\n')
  checked(['add', 'content.txt'])
  const cases = [
    ['Cursor checkpoint', 'checkpoint before checking out main\n', false],
    ['missing attribution', 'fix: fixture\n', false],
    ['body mention', `fix: fixture\n\nUsed ${codex} in this explanation.\n`, false],
    ['literal newline escapes', `fix: fixture\\n\\n${codex}`, false],
    ['wrong tool email', 'fix: fixture\n\nCo-authored-by: Codex <wrong@example.invalid>\n', false],
    ['contradictory authorship', `fix: fixture\n\n${codex}\nHuman-authored: true\n`, false],
    ['Codex', `fix: fixture\n\n${codex}\n`, true],
    ['Cursor', `fix: fixture\n\n${cursor}\n`, true],
    ['Claude Code', `fix: fixture\n\n${claude}\n`, true],
    ['multiple tools', `fix: fixture\n\n${codex}\n${cursor}\n`, true],
    ['CRLF message', `fix: fixture\r\n\r\n${cursor}\r\n`, true],
    ['explicit human', 'fix: fixture\n\nHuman-authored: true\n', true],
  ]
  const messagePath = resolve(fixture, 'commit message.txt')
  for (const [name, message, accepted] of cases) {
    await t.test(name, () => {
      writeFileSync(messagePath, message)
      const beforeHead = git(['rev-parse', '--verify', 'HEAD'])
      const beforeTree = checked(['write-tree'])
      const result = git(['commit', '--allow-empty', '--cleanup=verbatim', '-F', messagePath])
      assert.equal(result.status === 0, accepted, result.stderr || result.stdout)
      if (accepted) {
        const commit = git(['cat-file', 'commit', 'HEAD'])
        assert.equal(commit.status, 0, commit.stderr)
        assert.equal(commit.stdout.slice(commit.stdout.indexOf('\n\n') + 2), message)
      } else {
        assert.match(result.stderr, /uNAS:/)
        const afterHead = git(['rev-parse', '--verify', 'HEAD'])
        assert.equal(afterHead.status, beforeHead.status)
        assert.equal(afterHead.stdout, beforeHead.stdout)
        assert.equal(checked(['write-tree']), beforeTree)
      }
    })
  }
})
