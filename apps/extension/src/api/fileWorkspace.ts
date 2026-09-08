import * as directoryAdapter from './real/fileWorkspace'

/**
 * The only File Workspace surface available to React screens.
 *
 * Directory handles remain adapter-private. Writing is exposed only through
 * explicit, grant-scoped commands after the user has enabled write mode.
 */
export const fileWorkspacePort = Object.freeze({
  chooseDirectory: directoryAdapter.authorizeFileManagerDirectory,
  forgetDirectory: directoryAdapter.forgetFileManagerDirectory,
  getSnapshot: directoryAdapter.getFileWorkspaceSnapshot,
  listDirectory: directoryAdapter.listAuthorizedDirectory,
  requestWriteAccess: directoryAdapter.requestFileManagerDirectoryWriteAccess,
  restoreDirectory: directoryAdapter.restoreFileManagerDirectory,
  subscribe: directoryAdapter.subscribeFileWorkspace,
  createDirectory: directoryAdapter.createAuthorizedDirectory,
  createMarkdownFile: directoryAdapter.createAuthorizedMarkdownFile,
  deleteEntry: directoryAdapter.deleteAuthorizedDirectoryEntry,
  disableWriteAccess: directoryAdapter.disableFileManagerDirectoryWriteAccess,
})
