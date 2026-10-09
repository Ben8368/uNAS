export { createDavFilesPort } from './real/davFiles'
import { createDavFilesPort } from './real/davFiles'

/** Current page's memory-only Files connection, shared by its panes and preview readers. */
export const davFilesSession = createDavFilesPort()
