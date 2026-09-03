import { setApiClient } from 'unas-src/api/client'
import { demoApi } from 'unas-src/api/demo'

/** Initialize the self-contained demonstration API client. */
export function bootstrapApiClient() {
  setApiClient(demoApi)
}
