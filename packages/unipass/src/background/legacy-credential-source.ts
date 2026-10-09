import { accountCatalog, credentialAvailableForAccount, credentialForAccount } from '../shared/api'
import type { Credential, UniPassAccount } from '../shared/types'
import type { CredentialSource } from './credential-source'

/**
 * Legacy is an optional adapter. New WebDAV Vault code depends only on
 * CredentialSource and never imports the old API or credential-core.
 */
export const legacyCredentialSource: CredentialSource = {
  id: 'legacy-unipass',
  availability: legacyCredentialAvailability,
  async listAccounts(): Promise<readonly UniPassAccount[]> {
    const catalog = await accountCatalog()
    return catalog.entries.flatMap((entry) => entry.accounts)
  },
  getCredential(accountId: string): Promise<Credential> {
    return credentialForAccount(accountId)
  },
}

export async function legacyCredentialAvailability(accountId: string): Promise<'available' | 'empty'> {
  return (await credentialAvailableForAccount(accountId)) ? 'available' : 'empty'
}
