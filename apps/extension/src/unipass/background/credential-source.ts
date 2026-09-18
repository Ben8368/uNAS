import type { Credential, UniPassAccount } from '../shared/types'

/** Stable boundary between application services and a credential backend. */
export interface CredentialSource {
  readonly id: string
  listAccounts(): Promise<readonly UniPassAccount[]>
  getCredential(accountId: string): Promise<Credential>
}
