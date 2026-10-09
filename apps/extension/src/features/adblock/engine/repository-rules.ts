import bundledSource from '../../../../../../filters/unas.json?raw';

export const REPOSITORY_FILTER_URL = 'https://raw.githubusercontent.com/Ben8368/uNAS/main/filters/unas.json';
export const REPOSITORY_FILTER_STORAGE_KEY = 'unas_repository_filters';
export const REPOSITORY_FILTER_MAX_BYTES = 100_000;
export interface RepositoryRules {
  version: 1;
  revision: number;
  sites: { host: string; selectors: string[] }[];
}

// A deliberately small CSS grammar: class/ID targets, descendant combinators,
// and at most one terminal native :has() containing another target or an
// HTTP(S)/protocol-relative anchor prefix. No universal targets, CSS payloads,
// procedural operators, scriptlets, nested :has(), or arbitrary pseudo-classes.
const target = '[.#][a-zA-Z_][a-zA-Z0-9_-]*';
const compound = `(?:${target})+`;
const chain = `${compound}(?: ${compound}){0,3}`;
const anchor = 'a\\[href\\^="(?:https?://|//)[a-zA-Z0-9.-]+/[a-zA-Z0-9/_-]*"\\]';
const allowedSelector = new RegExp(`^${chain}(?::has\\((?:${chain}|(?:${chain} )?${anchor})\\))?$`);
const hostPattern = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export function validateRepositoryRules(value: unknown): value is RepositoryRules {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const source = value as RepositoryRules;
  if (Object.keys(source).some((key) => !['version', 'revision', 'sites'].includes(key))
    || source.version !== 1 || !Number.isSafeInteger(source.revision) || source.revision < 1
    || !Array.isArray(source.sites) || source.sites.length > 100) return false;
  let total = 0;
  const hosts = new Set<string>();
  for (const site of source.sites) {
    if (!site || typeof site !== 'object' || Object.keys(site).some((key) => !['host', 'selectors'].includes(key))
      || typeof site.host !== 'string' || !hostPattern.test(site.host) || hosts.has(site.host)
      || !Array.isArray(site.selectors) || site.selectors.length > 50) return false;
    hosts.add(site.host);
    total += site.selectors.length;
    if (total > 500 || !site.selectors.every((s) => typeof s === 'string' && s.length <= 512 && allowedSelector.test(s))) return false;
  }
  return new TextEncoder().encode(JSON.stringify(source)).byteLength <= REPOSITORY_FILTER_MAX_BYTES;
}

const bundled: unknown = JSON.parse(bundledSource);
if (!validateRepositoryRules(bundled)) throw new Error('Bundled repository filters are invalid.');
export const BUNDLED_REPOSITORY_RULES: RepositoryRules = bundled;

export function effectiveRepositoryRules(cached: unknown): RepositoryRules {
  return validateRepositoryRules(cached) && cached.revision >= BUNDLED_REPOSITORY_RULES.revision
    ? cached : BUNDLED_REPOSITORY_RULES;
}
