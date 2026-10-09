/**
 * Chrome can leave an already-open extension page running while a local build
 * replaces its hashed chunks. A lazy import from that old page then targets an
 * asset that no longer exists in the new extension bundle. Reload once so the
 * page receives the current HTML entrypoint, but never loop forever if the
 * current bundle is genuinely broken.
 */
const RECOVERY_KEY_PREFIX = 'unas.extension-assets.recovery:'

export type ExtensionAssetRecoveryStorage = Pick<Storage, 'getItem' | 'setItem'>

export type ExtensionAssetRecoveryEnvironment = {
  storage?: ExtensionAssetRecoveryStorage
  reload?: () => void
}

export function getAssetLoadErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function isExtensionAssetLoadError(error: unknown): boolean {
  return /failed to fetch dynamically imported module|importing a module script failed|loading chunk .+ failed|chunkloaderror/i.test(
    getAssetLoadErrorMessage(error),
  )
}

export function reloadAfterExtensionAssetLoadError(
  error: unknown,
  environment: ExtensionAssetRecoveryEnvironment = {},
): boolean {
  if (!isExtensionAssetLoadError(error)) return false

  try {
    const storage = environment.storage ?? window.sessionStorage
    const reload = environment.reload ?? (() => window.location.reload())
    const recoveryKey = `${RECOVERY_KEY_PREFIX}${getAssetLoadErrorMessage(error)}`

    if (storage.getItem(recoveryKey) === '1') return false

    storage.setItem(recoveryKey, '1')
    reload()
    return true
  } catch {
    // Storage can be unavailable in hardened browser contexts. Keep the
    // readable error UI rather than risking an unbounded reload loop.
    return false
  }
}
