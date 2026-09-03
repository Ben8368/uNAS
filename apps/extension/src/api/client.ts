import { demoApi } from 'unas-src/api/demo'

import type { UnasDemoApi } from './types'

let activeClient: UnasDemoApi = demoApi

/** Switch API implementation in tests or specialized integrations. */
export function setApiClient(client: UnasDemoApi): void {
  activeClient = client
}

export function getApiClient(): UnasDemoApi {
  return activeClient
}
