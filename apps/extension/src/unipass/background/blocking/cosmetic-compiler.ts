/**
 * Conservative compiler for the cosmetic subset of ABP-compatible lists.
 *
 * This module only emits validated selector data and a small, explicit
 * scriptlet descriptor. It never emits CSS/HTML or executable source from a
 * remote list.
 */
export const COSMETIC_GENERATION_VERSION = 1;
export const MAX_GLOBAL_SELECTORS = 1_500;
export const MAX_SITE_GROUPS = 2_000;
export const MAX_SELECTORS_PER_SITE = 100;
export const MAX_SCRIPTLETS_PER_SITE = 10;
export const MAX_SELECTOR_LENGTH = 512;
export const MAX_SCRIPTLET_ARGUMENT_LENGTH = 128;

export type SupportedScriptletName = "remove-attr";

export interface CosmeticScriptlet {
  id: string;
  name: SupportedScriptletName;
  args: string[];
}

export interface CosmeticSiteGroup {
  hosts: string[];
  excludedHosts: string[];
  selectors: string[];
  scriptlets: CosmeticScriptlet[];
  selectorExceptions: string[];
  scriptletExceptions: CosmeticScriptlet[];
}

export interface CosmeticCompilation {
  globalSelectors: string[];
  globalScriptlets: CosmeticScriptlet[];
  globalSelectorExceptions: string[];
  globalScriptletExceptions: CosmeticScriptlet[];
  sites: CosmeticSiteGroup[];
  report: {
    inputRules: number;
    selectors: number;
    scriptlets: number;
    skipped: number;
    invalid: number;
    exceptions: number;
    truncated: number;
    scriptletSkipped: number;
  };
}

interface RuleBucket {
  hosts: Set<string>;
  excludedHosts: Set<string>;
  selectors: Set<string>;
  scriptlets: Map<string, CosmeticScriptlet>;
  selectorExceptions: Set<string>;
  scriptletExceptions: Map<string, CosmeticScriptlet>;
}

const SCRIPTLET_NAMES = new Set<SupportedScriptletName>(["remove-attr"]);
// NUL is explicitly rejected because filter text is an untrusted boundary.
// eslint-disable-next-line no-control-regex
const unsafeSelector = /[{};<>\u0000]|(?:^|[\s>+~])(?:html|body|form|input|textarea|select|button)(?:[.#:[\s]|$)|(?:^|[\s(])(?:input|textarea|select|button|form)\b|(?:\[\s*(?:type\s*[*^$|~]?=\s*["']?password|autocomplete\s*[*^$|~]?=|contenteditable\s*=|role\s*=\s*["']?button))/i;
const unsupportedSelector = /:(?:has|contains|matches-css|matches-path|xpath|remove|style|nth-ancestor|watch-attr|upward|abp-has|abp-contains)\b|:-abp-(?:has|contains)\b|\+js\s*\(/i;
const validHost = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i;

export function compileCosmeticFilters(source: string): CosmeticCompilation {
  const buckets = new Map<string, RuleBucket>();
  const report: CosmeticCompilation["report"] = {
    inputRules: 0, selectors: 0, scriptlets: 0, skipped: 0, invalid: 0,
    exceptions: 0, truncated: 0, scriptletSkipped: 0,
  };
  for (const rawLine of source.replaceAll("\r\n", "\n").split("\n")) {
    const line = rawLine.trim();
    const parsed = parseCosmeticLine(line);
    if (!parsed) continue;
    report.inputRules += 1;
    if (parsed.kind === "skipped") { report.skipped += 1; continue; }
    if (parsed.kind === "invalid") { report.invalid += 1; continue; }
    if (parsed.exception) report.exceptions += 1;
    let bucket = buckets.get(parsed.scopeKey);
    if (!bucket) {
      bucket = {
        hosts: new Set(parsed.hosts), excludedHosts: new Set(parsed.excludedHosts),
        selectors: new Set(), scriptlets: new Map(), selectorExceptions: new Set(), scriptletExceptions: new Map(),
      };
      buckets.set(parsed.scopeKey, bucket);
    }
    const key = parsed.value.kind === "selector" ? parsed.value.selector : scriptletId(parsed.value);
    if (parsed.exception) {
      if (parsed.value.kind === "selector") bucket.selectorExceptions.add(key);
      else bucket.scriptletExceptions.set(key, parsed.value.scriptlet);
      continue;
    }
    if (parsed.value.kind === "selector") bucket.selectors.add(parsed.value.selector);
    else bucket.scriptlets.set(key, parsed.value.scriptlet);
  }

  const global = buckets.get("*");
  const globalSelectors = takeAllowed([...global?.selectors ?? []].filter((selector) => !global?.selectorExceptions.has(selector)), MAX_GLOBAL_SELECTORS, report);
  const globalScriptlets = takeScriptlets([...(global?.scriptlets.values() ?? [])].filter((scriptlet) => !global?.scriptletExceptions.has(scriptletId({ kind: "scriptlet", scriptlet }))), MAX_SCRIPTLETS_PER_SITE, report);
  const globalSelectorExceptions = takeAllowed([...global?.selectorExceptions ?? []], MAX_GLOBAL_SELECTORS, report);
  const globalScriptletExceptions = takeScriptlets([...(global?.scriptletExceptions.values() ?? [])], MAX_SCRIPTLETS_PER_SITE, report);
  const sites: CosmeticSiteGroup[] = [];
  for (const [scopeKey, bucket] of [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (scopeKey === "*") continue;
    if (sites.length >= MAX_SITE_GROUPS) { report.truncated += 1; break; }
    const selectors = takeAllowed([...bucket.selectors].filter((selector) => !bucket.selectorExceptions.has(selector)), MAX_SELECTORS_PER_SITE, report);
    const scriptlets = takeScriptlets([...bucket.scriptlets.values()].filter((scriptlet) => !bucket.scriptletExceptions.has(scriptletId({ kind: "scriptlet", scriptlet }))), MAX_SCRIPTLETS_PER_SITE, report);
    const selectorExceptions = takeAllowed([...bucket.selectorExceptions], MAX_SELECTORS_PER_SITE, report);
    const scriptletExceptions = takeScriptlets([...bucket.scriptletExceptions.values()], MAX_SCRIPTLETS_PER_SITE, report);
    if (selectors.length || scriptlets.length || selectorExceptions.length || scriptletExceptions.length) sites.push({
      hosts: [...bucket.hosts].sort(), excludedHosts: [...bucket.excludedHosts].sort(), selectors, scriptlets,
      selectorExceptions, scriptletExceptions,
    });
  }
  report.selectors = globalSelectors.length + sites.reduce((sum, site) => sum + site.selectors.length, 0);
  report.scriptlets = globalScriptlets.length + sites.reduce((sum, site) => sum + site.scriptlets.length, 0);
  return { globalSelectors, globalScriptlets, globalSelectorExceptions, globalScriptletExceptions, sites, report };
}

export function selectorIsSafe(selector: string): boolean {
  if (selector.length === 0 || selector.length > MAX_SELECTOR_LENGTH || unsafeSelector.test(selector) || unsupportedSelector.test(selector)) return false;
  if (/^[a-z][a-z0-9-]*$/i.test(selector) || selector === "*" || selector.includes("::")) return false;
  return true;
}

function parseCosmeticLine(line: string):
  | { kind: "skipped" }
  | { kind: "invalid" }
  | { kind: "rule"; scopeKey: string; hosts: string[]; excludedHosts: string[]; exception: boolean; value: { kind: "selector"; selector: string } | { kind: "scriptlet"; scriptlet: CosmeticScriptlet } }
  | null {
  if (!line || line.startsWith("!") || /^\[Adblock(?: Plus)?[\s\d.]*\]$/.test(line)) return null;
  const marker = findMarker(line);
  if (!marker) return null;
  const prefix = line.slice(0, marker.index);
  const body = line.slice(marker.index + marker.marker.length);
  if (!body || body.length > MAX_SELECTOR_LENGTH + 180) return { kind: "invalid" };
  const scope = parseScope(prefix);
  if (!scope) return { kind: "invalid" };
  if (marker.marker.includes("?") || marker.marker.includes("$")) return { kind: "skipped" };
  if (body.startsWith("+js(") || body.startsWith("+js(")) {
    if (!body.endsWith(")")) return { kind: "invalid" };
    const scriptlet = parseScriptlet(body.slice(4, -1));
    return scriptlet ? { kind: "rule", ...scope, exception: marker.exception, value: { kind: "scriptlet", scriptlet } } : { kind: "skipped" };
  }
  if (!selectorIsSafe(body)) return { kind: "skipped" };
  return { kind: "rule", ...scope, exception: marker.exception, value: { kind: "selector", selector: body } };
}

function findMarker(line: string): { index: number; marker: string; exception: boolean } | null {
  const markers = ["#@?#", "#?#", "#@$#", "#@#", "##?", "#$#", "##"];
  let best: { index: number; marker: string; exception: boolean } | null = null;
  for (const marker of markers) {
    const index = line.indexOf(marker);
    if (index < 0 || (best && index >= best.index)) continue;
    best = { index, marker, exception: marker.startsWith("#@") };
  }
  return best;
}

function parseScope(prefix: string): { scopeKey: string; hosts: string[]; excludedHosts: string[] } | null {
  if (!prefix) return { scopeKey: "*", hosts: [], excludedHosts: [] };
  const hosts: string[] = [], excludedHosts: string[] = [];
  for (const raw of prefix.split(",")) {
    if (!raw) return null;
    const excluded = raw.startsWith("~");
    const host = (excluded ? raw.slice(1) : raw).toLowerCase();
    if (!validHost.test(host) || host.includes("..") || host.startsWith(".") || host.endsWith(".")) return null;
    (excluded ? excludedHosts : hosts).push(host);
  }
  hosts.sort(); excludedHosts.sort();
  if (!hosts.length && !excludedHosts.length) return null;
  return { scopeKey: `${hosts.join(",")}|~${excludedHosts.join(",")}`, hosts, excludedHosts };
}

function parseScriptlet(value: string): CosmeticScriptlet | null {
  const parts = value.split(",").map((part) => part.trim());
  const name = parts.shift() as SupportedScriptletName | undefined;
  if (!name || !SCRIPTLET_NAMES.has(name) || parts.length !== 2) return null;
  // eslint-disable-next-line no-control-regex
  if (!parts.every((part) => part.length > 0 && part.length <= MAX_SCRIPTLET_ARGUMENT_LENGTH && !/[\u0000\r\n]/.test(part))) return null;
  if (!selectorIsSafe(parts[0]) || !/^[a-z][a-z0-9_-]{0,31}$/i.test(parts[1])) return null;
  return { id: "", name, args: parts };
}

function scriptletId(value: { kind: "scriptlet"; scriptlet: CosmeticScriptlet }): string {
  return `${value.scriptlet.name}:${value.scriptlet.args.join("\u001f")}`;
}

function takeAllowed(values: string[], limit: number, report: CosmeticCompilation["report"]): string[] {
  const selected = values.filter(selectorIsSafe).sort().slice(0, limit);
  if (values.length > selected.length) report.truncated += values.length - selected.length;
  return selected;
}

function takeScriptlets(values: CosmeticScriptlet[], limit: number, report: CosmeticCompilation["report"]): CosmeticScriptlet[] {
  const selected = values.sort((a, b) => scriptletId({ kind: "scriptlet", scriptlet: a }).localeCompare(scriptletId({ kind: "scriptlet", scriptlet: b }))).slice(0, limit)
    .map((scriptlet) => ({ ...scriptlet, id: scriptletId({ kind: "scriptlet", scriptlet }) }));
  if (values.length > selected.length) report.scriptletSkipped += values.length - selected.length;
  return selected;
}

export function hostMatches(host: string, group: Pick<CosmeticSiteGroup, "hosts" | "excludedHosts">): boolean {
  const matches = (candidate: string) => host === candidate || host.endsWith(`.${candidate}`);
  return !group.excludedHosts.some(matches) && (!group.hosts.length || group.hosts.some(matches));
}
