import type { AuthorizedDirectoryListing, FileWorkspaceAccessSnapshot } from '#contracts'
import type { ProjectionMessage } from './protocol'

export type ProjectionHostDeps = {
  self: () => string
  isOwner: () => boolean
  post: (message: ProjectionMessage) => void
  getSnapshot: () => FileWorkspaceAccessSnapshot
  listDirectory: (path?: string) => Promise<AuthorizedDirectoryListing>
}

/** Only the directory owner may publish; a client never re-broadcasts a snapshot. */
export function publishSnapshot(deps: ProjectionHostDeps, target?: string) {
  if (!deps.isOwner()) return
  deps.post({ version: 1, type: 'snapshot', sender: deps.self(), ...(target ? { target } : {}), snapshot: deps.getSnapshot() })
}

/** Answers read-only projection requests. Write operations never travel over this channel. */
export async function handleHostMessage(deps: ProjectionHostDeps, message: ProjectionMessage) {
  if (message.type === 'snapshot-request') { publishSnapshot(deps, message.sender); return }
  if (message.type !== 'list-request') return
  const reply = { version: 1 as const, type: 'list-result' as const, sender: deps.self(), target: message.sender, id: message.id }
  try {
    deps.post({ ...reply, listing: await deps.listDirectory(message.path) })
  } catch (error) {
    deps.post({ ...reply, error: error instanceof Error ? error.message : '目录投影读取失败。' })
  }
}
