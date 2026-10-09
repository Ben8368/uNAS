import { normalizeVersion } from "./version";

/** Enterprise API compatibility value, independent of uNAS or external release versions. */
export const LEGACY_PLUGIN_VERSION = "5.3.6";
export const PLUGIN_VERSION_OVERRIDE_STORAGE_KEY = "unipassNetworkVersionOverride";

export function normalizePluginVersion(value: unknown): string | null {
  return normalizeVersion(value);
}
