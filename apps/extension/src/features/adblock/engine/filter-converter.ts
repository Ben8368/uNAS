export const DEFAULT_RESOURCE_TYPES = Object.freeze([
  "main_frame", "sub_frame", "script", "image", "stylesheet", "font", "xmlhttprequest", "ping",
  "csp_report", "media", "object", "websocket", "webtransport", "webbundle", "other",
]);
const RESOURCE_TYPE_MAP = new Map(DEFAULT_RESOURCE_TYPES.map(type => [type, type]));
RESOURCE_TYPE_MAP.set("subdocument", "sub_frame");
const ABP_DOCUMENT_TYPES = ["main_frame", "sub_frame"];
export const PROTECTED_INITIATOR_DOMAINS = Object.freeze([
  "portal.unipass.top", "accounts.feishu.cn", "jupiter.tec-do.com",
  "gjphikebcceegfolnbfncepfmjnhdkam",
]);

export function convertFilterList(source: string) {
  const unique = new Map<string, chrome.declarativeNetRequest.Rule>();
  const report = { inputRules: 0, converted: 0, skipped: 0, invalid: 0, generatedDnr: 0, block: 0, allow: 0 };
  const candidates = source.replaceAll("\r\n", "\n").split("\n").map(line => line.trim());
  // badfilter disables the corresponding filter, regardless of source order.
  const disabled = new Set(candidates.filter(line => hasOption(line, "badfilter")).map(removeBadfilter));
  for (const candidate of candidates) {
    if (!candidate || candidate.startsWith("!") || /^\[Adblock(?: Plus)?[\s\d.]*\]$/.test(candidate)) continue;
    report.inputRules += 1;
    const result = disabled.has(removeBadfilter(candidate)) ? { kind: "skipped" as const } : parseFilter(candidate);
    if (result.kind !== "converted") { report[result.kind as "skipped" | "invalid"] += 1; continue; }
    report.converted += 1;
    unique.set(JSON.stringify(result.rule), result.rule);
  }
  const rules = [...unique.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([, rule], index) => ({ ...rule, id: index + 1 }));
  report.generatedDnr = rules.length;
  for (const rule of rules) report[rule.action.type as "block" | "allow"] += 1;
  return { rules, report };
}

function parseFilter(candidate: string): { kind: "skipped" | "invalid" } | { kind: "converted"; rule: chrome.declarativeNetRequest.Rule } {
  // Cosmetic, procedural, include and regex rules are compiled by their own
  // conservative modules or skipped; they are never silently weakened here.
  if (/#(?:@?\??#|@?\$#|@?%#)|^%include/.test(candidate)) return { kind: "skipped" };
  const allow = candidate.startsWith("@@");
  const filter = allow ? candidate.slice(2) : candidate;
  if (/^\/.*\/(?:\$|$)/.test(filter)) return { kind: "skipped" };
  const separator = filter.indexOf("$");
  const pattern = separator === -1 ? filter : filter.slice(0, separator);
  // Keep the converter ASCII-only; this rejects control characters and
  // Unicode syntax that the bounded DNR converter does not model.
  // eslint-disable-next-line no-control-regex
  if (!pattern || /[\u0000-\u0020\u007f-\uffff]/.test(pattern)) return { kind: "invalid" };
  if (pattern.startsWith("||*") || pattern.length > 2000) return { kind: "skipped" };
  const condition: chrome.declarativeNetRequest.RuleCondition = {
    urlFilter: pattern,
    resourceTypes: [...DEFAULT_RESOURCE_TYPES] as chrome.declarativeNetRequest.ResourceType[],
    excludedInitiatorDomains: [...PROTECTED_INITIATOR_DOMAINS],
  };
  const includedTypes: string[] = [], excludedTypes: string[] = [];
  let domainType: `${chrome.declarativeNetRequest.DomainType}` | undefined;
  for (const option of separator === -1 ? [] : filter.slice(separator + 1).split(",")) {
    if (!option) return { kind: "skipped" };
    if (option === "third-party" || option === "~third-party") {
      const next = (option === "third-party" ? "thirdParty" : "firstParty") as `${chrome.declarativeNetRequest.DomainType}`;
      if (domainType && domainType !== next) return { kind: "skipped" };
      domainType = next;
    } else if (option === "match-case") condition.isUrlFilterCaseSensitive = true;
    else if (option === "document") includedTypes.push(...ABP_DOCUMENT_TYPES);
    else if (option === "~document") excludedTypes.push(...ABP_DOCUMENT_TYPES);
    else if (option.startsWith("domain=")) {
      const included: string[] = [], excluded: string[] = [];
      for (const domain of option.slice(7).split("|")) {
        const negative = domain.startsWith("~");
        const value = negative ? domain.slice(1) : domain;
        if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(value) || value.includes("..")) return { kind: "skipped" };
        (negative ? excluded : included).push(value.toLowerCase());
      }
      if (included.length) {
        if (condition.initiatorDomains?.length) return { kind: "skipped" };
        condition.initiatorDomains = [...new Set(included)].sort();
      }
      condition.excludedInitiatorDomains!.push(...excluded);
    } else if (RESOURCE_TYPE_MAP.has(option)) includedTypes.push(RESOURCE_TYPE_MAP.get(option)!);
    else if (option.startsWith("~") && RESOURCE_TYPE_MAP.has(option.slice(1))) excludedTypes.push(RESOURCE_TYPE_MAP.get(option.slice(1))!);
    else return { kind: "skipped" }; // redirect, CSP, sitekey, important, removeparam, etc.
  }
  condition.domainType = domainType;
  condition.resourceTypes = [...new Set(includedTypes.length ? includedTypes : DEFAULT_RESOURCE_TYPES)]
    .filter(type => !excludedTypes.includes(type)).sort() as chrome.declarativeNetRequest.ResourceType[];
  if (!condition.resourceTypes.length) return { kind: "skipped" };
  condition.excludedInitiatorDomains = [...new Set(condition.excludedInitiatorDomains)].sort();
  return { kind: "converted", rule: {
    id: 1,
    priority: allow ? 2 : 1,
    action: { type: (allow ? "allow" : "block") as chrome.declarativeNetRequest.RuleActionType },
    condition,
  } };
}

function hasOption(line: string, option: string): boolean {
  const separator = line.indexOf("$");
  return separator >= 0 && line.slice(separator + 1).split(",").includes(option);
}

function removeBadfilter(line: string): string {
  const separator = line.indexOf("$");
  if (separator < 0) return line;
  const options = line.slice(separator + 1).split(",").filter((option) => option !== "badfilter");
  return options.length ? `${line.slice(0, separator)}$${options.join(",")}` : line.slice(0, separator);
}
