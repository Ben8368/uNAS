export type FileManagerSection = 'webdav' | 'local' | 'downloads' | 'trash' | 'cache'
let section: FileManagerSection = 'local'
const listeners = new Set<() => void>()
export const getFileManagerSection = () => section
export function setFileManagerSection(next: FileManagerSection) { section = next; for (const listener of listeners) listener() }
export function subscribeFileManagerSection(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
