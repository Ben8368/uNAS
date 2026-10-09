import type { AuthorizedDirectoryListing, FileRef, FileReadLease, FileReadOptions, FileWorkspaceAccessSnapshot } from '#contracts'
import { inlineWorkspace } from 'unas-src/platform/workspace/inlineWorkspace'
import * as directoryAdapter from './real/fileWorkspace'
import { ProjectionClient } from './workspace/projection-client'
import { ProjectionRuntime } from './workspace/projection-runtime'

const unavailableSnapshot: FileWorkspaceAccessSnapshot = {
  status: 'requires-user',
  message: '目录 Workspace 已关闭或不可用;不会自动恢复目录操作。',
}

const runtime = new ProjectionRuntime()
const client = new ProjectionClient()

function requiresOwner() {
  return new Error('此页面只显示由另一个 Workspace 管理的目录投影。请回到目录所有者页面执行授权或写入操作。')
}

function workspaceUnavailable() {
  return new Error('目录 Workspace 已关闭或不可用；不会自动重放操作。请回到目录所有者页面后重试。')
}

function isOwner() {
  return inlineWorkspace.getState() === 'owner'
}

function isClient() {
  return inlineWorkspace.getState() === 'client'
}

function currentSnapshot(): FileWorkspaceAccessSnapshot {
  if (isOwner()) return directoryAdapter.getFileWorkspaceSnapshot()
  if (isClient()) return client.currentSnapshot
  return unavailableSnapshot
}

/** The only File Workspace surface available to React screens. */
export const fileWorkspacePort = Object.freeze({
  canManageDirectory: isOwner,
  chooseDirectory: async () => {
    if (!isOwner()) throw requiresOwner()
    return await directoryAdapter.authorizeFileManagerDirectory()
  },
  forgetDirectory: async () => {
    if (!isOwner()) throw requiresOwner()
    return await directoryAdapter.forgetFileManagerDirectory()
  },
  getSnapshot: currentSnapshot,
  listDirectory: async (path?: string) => {
    if (isOwner()) return await directoryAdapter.listAuthorizedDirectory(path)
    if (!isClient()) throw workspaceUnavailable()
    return await client.listDirectory(path)
  },
  createFileRef: async (path: string) => {
    if (!isOwner()) throw requiresOwner()
    return await directoryAdapter.createAuthorizedFileRef(path)
  },
  fileMetadata: async (ref: FileRef) => {
    if (!isOwner()) throw requiresOwner()
    return await directoryAdapter.getAuthorizedFileMetadata(ref)
  },
  localMediaFile: async (ref: FileRef) => {
    if (!isOwner()) throw requiresOwner()
    return await directoryAdapter.getAuthorizedMediaFile(ref)
  },
  exportFileRef: async (ref: FileRef) => {
    if (!isOwner()) throw requiresOwner()
    return await directoryAdapter.exportAuthorizedFileRef(ref)
  },
  openFileRead: async (ref: FileRef, options?: FileReadOptions): Promise<FileReadLease> => {
    if (!isOwner()) throw requiresOwner()
    return await directoryAdapter.openAuthorizedFileRef(ref, options)
  },
  requestWriteAccess: async () => {
    if (!isOwner()) throw requiresOwner()
    return await directoryAdapter.requestFileManagerDirectoryWriteAccess()
  },
  restoreDirectory: async () => {
    runtime.ensureChannel(client)
    if (isOwner()) return await directoryAdapter.restoreFileManagerDirectory()
    if (isClient()) return await client.requestSnapshot()
    return currentSnapshot()
  },
  subscribe: (listener: () => void) => {
    runtime.ensureChannel(client)
    return runtime.subscribe(listener)
  },
  createDirectory: async (path: string, name: string) => {
    if (!isOwner()) throw requiresOwner()
    return await directoryAdapter.createAuthorizedDirectory(path, name)
  },
  createMarkdownFile: async (path: string, name: string) => {
    if (!isOwner()) throw requiresOwner()
    return await directoryAdapter.createAuthorizedMarkdownFile(path, name)
  },
  extractZip: async (path: string, name: string) => {
    if (!isOwner()) throw requiresOwner()
    return await directoryAdapter.extractAuthorizedZip(path, name)
  },
  cancelZipExtraction: () => {
    if (!isOwner()) throw requiresOwner()
    return directoryAdapter.cancelAuthorizedZipExtraction()
  },
  deleteEntry: async (path: string, name: string) => {
    if (!isOwner()) throw requiresOwner()
    return await directoryAdapter.deleteAuthorizedDirectoryEntry(path, name)
  },
  disableWriteAccess: () => {
    if (!isOwner()) throw requiresOwner()
    return directoryAdapter.disableFileManagerDirectoryWriteAccess()
  },
})
