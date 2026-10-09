import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { convertFilterList, PROTECTED_INITIATOR_DOMAINS } from "../scripts/convert-filter-rules.mjs";

const built = await build({ entryPoints: ["src/background/blocking/rule-compactor.ts"], bundle: true, platform: "node", format: "esm", write: false });
const { compactDomainRules, DOMAIN_BATCH_SIZE } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString("base64")}`);

test("domain compaction is bounded, deterministic and retains every domain and protected initiator", () => {
  const domains = Array.from({ length: 30_010 }, (_, index) => `ads${index}.example`);
  const source = domains.map(domain => `||${domain}^`).join("\n");
  const rules = convertFilterList(source).rules;
  const compacted = compactDomainRules(rules);
  assert.equal(compacted.length, Math.ceil(domains.length / DOMAIN_BATCH_SIZE));
  assert.deepEqual(compacted.flatMap(rule => rule.condition.requestDomains).sort(), domains.sort());
  assert.deepEqual(compactDomainRules(convertFilterList(source.split("\n").reverse().join("\n")).rules), compacted);
  for (const [index, rule] of compacted.entries()) {
    assert.equal(rule.id, index + 1);
    assert.equal(rule.condition.urlFilter, undefined);
    assert.ok(rule.condition.requestDomains.length <= DOMAIN_BATCH_SIZE);
    assert.deepEqual(rule.condition.excludedInitiatorDomains, [...PROTECTED_INITIATOR_DOMAINS].sort());
    assert.equal(rule.condition.resourceTypes.includes("main_frame"), true);
  }
});

test("compaction never merges different actions, initiators, party scopes or resource types", () => {
  const { rules } = convertFilterList(`||one.example^
||two.example^
@@||one.example^$script,domain=reader.example
||three.example^$third-party
||four.example^$~third-party
||five.example^$image
||six.example^$domain=site.example|~private.site.example`);
  const compacted = compactDomainRules(rules);
  assert.equal(compacted.length, 6);
  const allow = compacted.find(rule => rule.action.type === "allow");
  assert.equal(allow.priority, 2);
  assert.deepEqual(allow.condition.requestDomains, ["one.example"]);
  assert.deepEqual(allow.condition.resourceTypes, ["script"]);
  assert.deepEqual(allow.condition.initiatorDomains, ["reader.example"]);
  assert.equal(compacted.find(rule => rule.condition.requestDomains.includes("three.example")).condition.domainType, "thirdParty");
  assert.equal(compacted.find(rule => rule.condition.requestDomains.includes("four.example")).condition.domainType, "firstParty");
  assert.ok(compacted.find(rule => rule.condition.requestDomains.includes("six.example")).condition.excludedInitiatorDomains.includes("private.site.example"));
});

test("path, wildcard, port, uppercase and case-sensitive filters retain their exact URL conditions", () => {
  const { rules } = convertFilterList(`||ads.example/banner^
||ads.example:8080^
||ads*.example^
||UPPER.example^
||case.example^$match-case
/ads/banner.jpg`);
  assert.deepEqual(compactDomainRules(rules), rules);
});
