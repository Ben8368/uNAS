

import * as filesystem from './filesystem'
import * as fonts from './fonts'
import * as jobs from './jobs'
import * as logs from './logs'
import * as metrics from './metrics'
import * as tasks from './tasks'

/** Archived desktop HTTP adapter; never selected or exported by the Demo entrypoint. */
export const realApi = {
  ...tasks,
  ...jobs,
  ...filesystem,
  ...metrics,
  ...logs,
  ...fonts,
}
