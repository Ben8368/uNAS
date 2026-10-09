import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script'
import 'unas-src/platform/archive/archiveExtraction.worker'

// WXT only bundles declared entrypoints. This unlisted module is loaded by an extension page as a dedicated Worker.
export default defineUnlistedScript(() => undefined)
