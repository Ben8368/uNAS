import type { AvailableAppsResult } from "../../shared/types";
import type { AccountRef } from "../../shared/vault";
import { credentialAvailabilityForRef, vaultCatalog, type WebDavVaultCatalogResult } from "./vault-service";

/** Returns only WebDAV apps with at least one credential that can be used. */
export async function availableVaultApps(keyword: string): Promise<AvailableAppsResult> {
  return filterVaultAppsByAvailability(await vaultCatalog(), credentialAvailabilityForRef, keyword);
}

export async function filterVaultAppsByAvailability(
  catalog: WebDavVaultCatalogResult,
  check: (ref: AccountRef) => Promise<"available" | "empty">,
  keyword = "",
): Promise<AvailableAppsResult> {
  const filter = keyword.trim().toLowerCase();
  const entries = catalog.entries.filter(({ app }) => !filter || app.name.toLowerCase().includes(filter));
  const inspected = await Promise.all(entries.map(async ({ app, accounts }) => {
    if (!accounts.length) return { app, result: "empty" as const };
    const statuses = await Promise.all(accounts.map(async (account) => {
      try {
        return await check({ vaultId: account.vaultId, accountId: account.id });
      } catch {
        return "error" as const;
      }
    }));
    if (statuses.includes("available")) return { app, result: "available" as const };
    if (statuses.includes("error")) return { app, result: "verification-failure" as const };
    return { app, result: "empty" as const };
  }));
  return {
    apps: inspected.filter((entry) => entry.result === "available").map((entry) => entry.app),
    totalApps: entries.length + catalog.failures.length,
    excludedEmptyCredentialApps: inspected.filter((entry) => entry.result === "empty").length,
    excludedVerificationFailureApps: inspected.filter((entry) => entry.result === "verification-failure").length,
    excludedDirectoryFailureApps: catalog.failures.length,
  };
}
