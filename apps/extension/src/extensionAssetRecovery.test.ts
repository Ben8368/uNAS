import { describe, expect, it, vi } from 'vitest'

import {
  isExtensionAssetLoadError,
  reloadAfterExtensionAssetLoadError,
  type ExtensionAssetRecoveryStorage,
} from 'unas-src/extensionAssetRecovery'

function createStorage(): ExtensionAssetRecoveryStorage {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}

describe('extension asset recovery', () => {
  const staleChunkError = new TypeError(
    'Failed to fetch dynamically imported module: chrome-extension://example/chunks/FileManagerApp-old.js',
  )

  it('recognizes browser errors emitted for missing lazy chunks', () => {
    expect(isExtensionAssetLoadError(staleChunkError)).toBe(true)
    expect(isExtensionAssetLoadError(new TypeError('Importing a module script failed.'))).toBe(true)
    expect(isExtensionAssetLoadError(new Error('File metadata is invalid'))).toBe(false)
  })

  it('reloads once for a stale extension asset and then leaves a persistent failure visible', () => {
    const reload = vi.fn()
    const environment = { storage: createStorage(), reload }

    expect(reloadAfterExtensionAssetLoadError(staleChunkError, environment)).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)

    expect(reloadAfterExtensionAssetLoadError(staleChunkError, environment)).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('does not reload for unrelated application errors', () => {
    const reload = vi.fn()

    expect(reloadAfterExtensionAssetLoadError(new Error('Permission denied'), {
      storage: createStorage(),
      reload,
    })).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })
})
