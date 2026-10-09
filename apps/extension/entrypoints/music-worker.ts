import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script'
import 'unas-src/features/music/musicDecrypt.worker'

// WXT bundles the real music engine as a dedicated Worker entrypoint.
export default defineUnlistedScript(() => undefined)
