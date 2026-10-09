import { compileCosmeticFilters, hostMatches, selectorIsSafe, type CosmeticCompilation, type CosmeticScriptlet } from "./cosmetic-compiler";
import { BUILTIN_COSMETIC_FILTERS } from "./builtin-filters";
export type { CosmeticScriptlet } from "./cosmetic-compiler";

export const COSMETIC_STORAGE_KEY = "unipass_cosmetic_store";
export const COSMETIC_STAGING_STORAGE_KEY = "unipass_cosmetic_store_staging";
export const COSMETIC_STORE_VERSION = 2;
export const MAX_COSMETIC_STORAGE_BYTES = 1_000_000;

// Keep compatibility filters effective for stores created before they were added.
// Persisted remote stores are valid across rule updates, so they cannot be relied
// on to contain the current built-ins.
const BUILTIN_COSMETIC_COMPILATION = compileCosmeticFilters(BUILTIN_COSMETIC_FILTERS);

export interface CosmeticStore {
  version: 2;
  generation: number;
  globalSelectors: string[];
  globalScriptlets: CosmeticScriptlet[];
  globalSelectorExceptions: string[];
  globalScriptletExceptions: CosmeticScriptlet[];
  sites: CosmeticCompilation["sites"];
  report: CosmeticCompilation["report"];
}

export interface PageCosmeticRules {
  generation: number;
  selectors: string[];
  scriptlets: CosmeticScriptlet[];
}

export function createCosmeticStore(source: string, generation: number): CosmeticStore {
  const compiled = compileCosmeticFilters(`${BUILTIN_COSMETIC_FILTERS}\n${source}`);
  const store: CosmeticStore = { version: 2, generation, ...compiled };
  const serialized = JSON.stringify(store);
  if (new TextEncoder().encode(serialized).byteLength > MAX_COSMETIC_STORAGE_BYTES) throw new Error("cosmetic 规则数据超过安全大小限制");
  return store;
}

export function validateCosmeticStore(value: unknown): value is CosmeticStore {
  if (!value || typeof value !== "object") return false;
  const store = value as CosmeticStore;
  if (store.version !== COSMETIC_STORE_VERSION || !Number.isInteger(store.generation) || store.generation < 1) return false;
  if (!Array.isArray(store.globalSelectors) || !Array.isArray(store.globalScriptlets)
    || !Array.isArray(store.globalSelectorExceptions) || !Array.isArray(store.globalScriptletExceptions) || !Array.isArray(store.sites)
    || !store.report || typeof store.report !== "object") return false;
  if (store.globalSelectors.length > 1_500 || store.sites.length > 2_000) return false;
  return store.globalSelectors.every(isSelector) && store.globalScriptlets.every(isScriptlet)
    && store.globalSelectorExceptions.length <= 1_500 && store.globalSelectorExceptions.every(isSelector)
    && store.globalScriptletExceptions.length <= 10 && store.globalScriptletExceptions.every(isScriptlet)
    && store.sites.every((site) => Array.isArray(site.hosts) && Array.isArray(site.excludedHosts)
      && site.hosts.every(isHost) && site.excludedHosts.every(isHost)
      && Array.isArray(site.selectors) && site.selectors.length <= 100 && site.selectors.every(isSelector)
      && Array.isArray(site.scriptlets) && site.scriptlets.length <= 10 && site.scriptlets.every(isScriptlet)
      && Array.isArray(site.selectorExceptions) && site.selectorExceptions.length <= 100 && site.selectorExceptions.every(isSelector)
      && Array.isArray(site.scriptletExceptions) && site.scriptletExceptions.length <= 10 && site.scriptletExceptions.every(isScriptlet))
    && new TextEncoder().encode(JSON.stringify(store)).byteLength <= MAX_COSMETIC_STORAGE_BYTES;
}

export function pageRulesForHost(store: CosmeticStore | undefined, hostname: string): PageCosmeticRules {
  if (!store || !isHost(hostname)) return { generation: store?.generation ?? 0, selectors: [], scriptlets: [] };
  const selectors: string[] = [];
  const scriptlets: CosmeticScriptlet[] = [];
  const selectorExceptions = new Set<string>();
  const scriptletExceptions = new Set<string>();
  const append = (compilation: Pick<CosmeticCompilation, "globalSelectors" | "globalScriptlets" | "globalSelectorExceptions" | "globalScriptletExceptions" | "sites">): void => {
    selectors.push(...compilation.globalSelectors);
    scriptlets.push(...compilation.globalScriptlets);
    compilation.globalSelectorExceptions.forEach((selector) => selectorExceptions.add(selector));
    compilation.globalScriptletExceptions.forEach((scriptlet) => scriptletExceptions.add(scriptletKey(scriptlet)));
    for (const site of compilation.sites) if (hostMatches(hostname, site)) {
      selectors.push(...site.selectors);
      scriptlets.push(...site.scriptlets);
      site.selectorExceptions.forEach((selector) => selectorExceptions.add(selector));
      site.scriptletExceptions.forEach((scriptlet) => scriptletExceptions.add(scriptletKey(scriptlet)));
    }
  };
  // Compatibility rules must be first: the content script has a bounded CSS
  // budget, so a large remote list must not push these audited rules out.
  append(BUILTIN_COSMETIC_COMPILATION);
  append(store);
  return {
    generation: store.generation,
    selectors: [...new Set(selectors)].filter((selector) => !selectorExceptions.has(selector)),
    scriptlets: uniqueScriptlets(scriptlets).filter((scriptlet) => !scriptletExceptions.has(scriptletKey(scriptlet))),
  };
}

function isSelector(value: unknown): value is string { return typeof value === "string" && value.length > 0 && value.length <= 512; }
function isHost(value: unknown): value is string { return typeof value === "string" && /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(value); }
function isScriptlet(value: unknown): value is CosmeticScriptlet {
  const scriptlet = value as CosmeticScriptlet;
  return Boolean(scriptlet && scriptlet.id && scriptlet.name === "remove-attr" && Array.isArray(scriptlet.args)
    && scriptlet.args.length === 2 && scriptlet.args.every((arg) => typeof arg === "string" && arg.length > 0 && arg.length <= 128)
    && selectorIsSafe(scriptlet.args[0]) && /^[a-zA-Z][a-zA-Z0-9:_-]{0,63}$/.test(scriptlet.args[1]));
}
function uniqueScriptlets(values: CosmeticScriptlet[]): CosmeticScriptlet[] {
  return [...new Map(values.map((value) => [scriptletKey(value), value])).values()];
}
function scriptletKey(value: CosmeticScriptlet): string { return `${value.name}\u001f${value.args.join("\u001f")}`; }
