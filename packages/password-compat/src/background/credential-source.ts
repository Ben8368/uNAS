import type { Credential, LegacyAccount } from '../shared/types'

/** Stable boundary between application services and a credential backend. */
export interface CredentialSource {
  readonly id: string
  readonly availability: (accountId: string) => Promise<'available' | 'empty'>
  listAccounts(): Promise<readonly LegacyAccount[]>
  getCredential(accountId: string): Promise<Credential>
}
