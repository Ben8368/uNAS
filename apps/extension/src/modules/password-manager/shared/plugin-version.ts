import { normalizeVersion } from "./version";

/**
 * UniPass Chrome Web Store version used by the Legacy API compatibility layer.
 * Keep public/runtime-config.json in sync; it supplies the default request header.
 * This baseline is independent of the uNAS extension manifest version.
 */
export const STORE_PLUGIN_VERSION = "5.3.5";
export const PLUGIN_VERSION_OVERRIDE_STORAGE_KEY = "unipassNetworkVersionOverride";

export function normalizePluginVersion(value: unknown): string | null {
  return normalizeVersion(value);
}
