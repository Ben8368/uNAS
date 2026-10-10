import { spawnSync } from 'node:child_process'
import { chmodSync, readdirSync, realpathSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

function git(root, args, allowedStatuses = [0]) {
  const result = spawnSync('git', ['-C', root, ...args], {
    encoding: 'utf8', windowsHide: true, timeout: 10_000,
  })
  if (result.error) throw result.error
  if (!allowedStatuses.includes(result.status)) {
    throw new Error(result.stderr.trim() || `git ${args[0]} failed (${result.status})`)
  }
  return result.stdout.trim()
}

export function installGitHooks(root = resolve(import.meta.dirname, '..')) {
  const rootPath = realpathSync(root)
  const repoRoot = realpathSync(git(rootPath, ['rev-parse', '--show-toplevel']))
  if (repoRoot !== rootPath) throw new Error('Root must be the repository root, not a subdirectory')
  const hookPath = resolve(rootPath, '.githooks/commit-msg')
  if (!statSync(hookPath).isFile()) throw new Error('Missing .githooks/commit-msg')
  const configuredPath = git(rootPath, ['config', '--get', 'core.hooksPath'], [0, 1])
  if (configuredPath && resolve(rootPath, configuredPath) !== resolve(rootPath, '.githooks')) {
    throw new Error(`Existing core.hooksPath is preserved: ${configuredPath}. Integrate hooks manually.`)
  }
  if (!configuredPath) {
    const defaultHooks = resolve(rootPath, git(rootPath, ['rev-parse', '--git-path', 'hooks']))
    let entries
    try {
      entries = readdirSync(defaultHooks, { withFileTypes: true })
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      entries = []
    }
    if (entries.some((entry) => (entry.isFile() || entry.isSymbolicLink()) && !entry.name.endsWith('.sample'))) {
      throw new Error('Existing hooks are preserved. Integrate hooks manually.')
    }
  }
  // Git requires executable hooks on Linux/macOS; this does not change message content.
  chmodSync(hookPath, 0o755)
  git(rootPath, ['config', '--local', 'core.hooksPath', '.githooks'])
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    installGitHooks(process.argv[2])
    console.log('uNAS commit attribution hook enabled for this repository.')
  } catch (error) {
    console.error(`Git hook installation FAILED: ${error.message}`)
    process.exitCode = 1
  }
}
