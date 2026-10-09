import type { FileRef, FileReadLease, FileReadOptions, FileWorkspaceAccessSnapshot } from '#contracts'
import * as directoryAdapter from './real/fileWorkspace'
import { isClient, isOwner, projectionClient, connectProjection, subscribeProjection } from './workspace/projection-runtime'
import { workspaceUnavailable } from './workspace/projection-client'

const unavailableSnapshot: FileWorkspaceAccessSnapshot = { status: 'requires-user', message: '目录 Workspace 已关闭或不可用；不会自动恢复目录操作。' }

function requiresOwner() {
  return new Error('此页面只显示由另一个 Workspace 管理的目录投影。请回到目录所有者页面执行授权或写入操作。')
}
function currentSnapshot(): FileWorkspaceAccessSnapshot {
  if (isOwner()) return directoryAdapter.getFileWorkspaceSnapshot()
  if (isClient()) return projectionClient.getSnapshot()
  return unavailableSnapshot
}

/**
 * The only File Workspace surface available to React screens.
 * owner → real adapter; client → read-only projection; neither → unavailable.
 */
export const fileWorkspacePort = Object.freeze({
  canManageDirectory: isOwner,
  chooseDirectory: async () => { if (!isOwner()) throw requiresOwner(); return await directoryAdapter.authorizeFileManagerDirectory() },
  forgetDirectory: async () => { if (!isOwner()) throw requiresOwner(); return await directoryAdapter.forgetFileManagerDirectory() },
  getSnapshot: currentSnapshot,
  listDirectory: async (path?: string) => {
    if (isOwner()) return await directoryAdapter.listAuthorizedDirectory(path)
    if (!isClient()) throw workspaceUnavailable()
    return await projectionClient.listDirectory(path)
  },
  createFileRef: async (path: string) => { if (!isOwner()) throw requiresOwner(); return await directoryAdapter.createAuthorizedFileRef(path) },
  fileMetadata: async (ref: FileRef) => { if (!isOwner()) throw requiresOwner(); return await directoryAdapter.getAuthorizedFileMetadata(ref) },
  localMediaFile: async (ref: FileRef) => { if (!isOwner()) throw requiresOwner(); return await directoryAdapter.getAuthorizedMediaFile(ref) },
  exportFileRef: async (ref: FileRef) => { if (!isOwner()) throw requiresOwner(); return await directoryAdapter.exportAuthorizedFileRef(ref) },
  openFileRead: async (ref: FileRef, options?: FileReadOptions): Promise<FileReadLease> => { if (!isOwner()) throw requiresOwner(); return await directoryAdapter.openAuthorizedFileRef(ref, options) },
  requestWriteAccess: async () => { if (!isOwner()) throw requiresOwner(); return await directoryAdapter.requestFileManagerDirectoryWriteAccess() },
  restoreDirectory: async () => {
    connectProjection()
    if (isOwner()) return await directoryAdapter.restoreFileManagerDirectory()
    if (isClient()) return await projectionClient.requestSnapshot()
    return currentSnapshot()
  },
  subscribe: subscribeProjection,
  createDirectory: async (path: string, name: string) => { if (!isOwner()) throw requiresOwner(); return await directoryAdapter.createAuthorizedDirectory(path, name) },
  createMarkdownFile: async (path: string, name: string) => { if (!isOwner()) throw requiresOwner(); return await directoryAdapter.createAuthorizedMarkdownFile(path, name) },
  extractZip: async (path: string, name: string) => { if (!isOwner()) throw requiresOwner(); return await directoryAdapter.extractAuthorizedZip(path, name) },
  cancelZipExtraction: () => { if (!isOwner()) throw requiresOwner(); return directoryAdapter.cancelAuthorizedZipExtraction() },
  deleteEntry: async (path: string, name: string) => { if (!isOwner()) throw requiresOwner(); return await directoryAdapter.deleteAuthorizedDirectoryEntry(path, name) },
  disableWriteAccess: () => { if (!isOwner()) throw requiresOwner(); return directoryAdapter.disableFileManagerDirectoryWriteAccess() },
})
