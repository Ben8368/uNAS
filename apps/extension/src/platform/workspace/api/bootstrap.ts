import { setApiClient } from 'unas-src/platform/workspace/api/client'
import { demoApi } from 'unas-src/platform/demo'

/** Initialize the self-contained demonstration API client. */
export function bootstrapApiClient() {
  setApiClient(demoApi)
}
