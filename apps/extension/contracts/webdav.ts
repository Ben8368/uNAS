/** Project connection metadata. Secrets never enter UI projections. */
export type WebDavConnection = { id: string; name: string; endpoint: string; revision: string; vaultEndpoint: string }
export type WebDavSaveInput = { id?: string; name: string; endpoint: string; username: string; appPassword: string; consent: boolean; vaultKey?: string }
export type WebDavSaveResult = { connection: WebDavConnection; vaultReady: boolean; vaultError?: string; recoveryKey?: string }
