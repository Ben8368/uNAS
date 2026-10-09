import { describe, expect, it } from 'vitest';
import { BUNDLED_REPOSITORY_RULES, effectiveRepositoryRules, validateRepositoryRules } from './repository-rules';
import { createCosmeticStore, pageRulesForHost } from './cosmetic-store';

const rules = (selector: string) => ({ version: 1, revision: 2, sites: [{ host: 'www.example.com', selectors: [selector] }] });

describe('repository subscription schema', () => {
  it('validates the single-source bundled snapshot and permits bounded new site rules', () => {
    expect(validateRepositoryRules(BUNDLED_REPOSITORY_RULES)).toBe(true);
    expect(validateRepositoryRules(rules('.sponsor'))).toBe(true);
    expect(validateRepositoryRules(rules('.card:has(a[href^="https://ads.example.com/"])'))).toBe(true);
    const cached = rules('.sponsor');
    expect(pageRulesForHost(createCosmeticStore('', 1), 'www.example.com', cached).selectors).toContain('.sponsor');
    expect(pageRulesForHost(createCosmeticStore('', 1), 'child.www.example.com', cached).selectors).not.toContain('.sponsor');
    expect(effectiveRepositoryRules(cached)).toBe(cached);
  });

  it.each(['*', 'body', 'form input', '.ad{display:none}', '.ad; a', '.ad:has(*)', '.ad:has(.x:has(.y))',
    '.ad:has(a[href^="javascript:"])', '.ad:has-text(ad)', '.ad::before', '.ad,html', '.ad:has(button)',
    '.ad:has(a[href^="https://evil.com/"]){}/*"])'])('rejects unsupported CSS %s', (selector) => {
    expect(validateRepositoryRules(rules(selector))).toBe(false);
  });

  it('rejects executable/unknown fields, invalid hosts, revisions and resource overflows', () => {
    const source = rules('.ad');
    expect(validateRepositoryRules({ ...source, script: 'alert(1)' })).toBe(false);
    expect(validateRepositoryRules({ ...source, version: 2 })).toBe(false);
    expect(validateRepositoryRules({ ...source, revision: -1 })).toBe(false);
    expect(validateRepositoryRules({ ...source, sites: [{ host: '*.example.com', selectors: ['.ad'] }] })).toBe(false);
    expect(validateRepositoryRules({ ...source, sites: [{ host: 'example.com', selectors: Array(51).fill('.ad') }] })).toBe(false);
    expect(validateRepositoryRules(rules('.' + 'a'.repeat(512)))).toBe(false);
    expect(validateRepositoryRules({ ...source, sites: [source.sites[0], source.sites[0]] })).toBe(false);
  });

  it('falls back on corrupt/older cache and lets a newer empty revision remove a bad rule', () => {
    expect(effectiveRepositoryRules({ ...rules('.ad'), revision: 0 })).toBe(BUNDLED_REPOSITORY_RULES);
    expect(effectiveRepositoryRules(null)).toBe(BUNDLED_REPOSITORY_RULES);
    const empty = { version: 1, revision: 2, sites: [] };
    expect(pageRulesForHost(createCosmeticStore('', 1), 'www.bilibili.com', empty).selectors).toEqual([]);
  });
});
