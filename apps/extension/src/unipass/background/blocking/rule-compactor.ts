// Bound individual conditions as well as total rule count. Never merge different scopes.
export const DOMAIN_BATCH_SIZE = 500;

export function compactDomainRules(rules: chrome.declarativeNetRequest.Rule[]): chrome.declarativeNetRequest.Rule[] {
  const result: chrome.declarativeNetRequest.Rule[] = [];
  const groups = new Map<string, { rule: chrome.declarativeNetRequest.Rule; domains: Set<string> }>();
  for (const rule of rules) {
    const domain = /^\|\|([a-z0-9]+(?:[.-][a-z0-9]+)*)\^$/.exec(rule.condition.urlFilter ?? "")?.[1];
    // Paths, wildcards, ports, case-sensitive patterns and existing domain conditions stay intact.
    if (!domain || rule.condition.isUrlFilterCaseSensitive || rule.condition.requestDomains
      || rule.condition.excludedRequestDomains || rule.condition.regexFilter) {
      result.push(rule);
      continue;
    }
    const { urlFilter: _pattern, ...condition } = rule.condition;
    const template = { ...rule, id: 1, condition };
    const key = JSON.stringify(template);
    let group = groups.get(key);
    if (!group) { group = { rule: template, domains: new Set() }; groups.set(key, group); }
    group.domains.add(domain);
  }
  for (const { rule, domains } of groups.values()) {
    const sorted = [...domains].sort();
    for (let offset = 0; offset < sorted.length; offset += DOMAIN_BATCH_SIZE) {
      result.push({ ...rule, condition: { ...rule.condition, requestDomains: sorted.slice(offset, offset + DOMAIN_BATCH_SIZE) } });
    }
  }
  return result.map((rule, index) => ({ ...rule, id: index + 1 }));
}
