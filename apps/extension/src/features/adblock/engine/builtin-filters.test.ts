import { describe, expect, it } from "vitest";
import { BUNDLED_REPOSITORY_RULES } from "./repository-rules";
import { compileCosmeticFilters } from "./cosmetic-compiler";
import { createCosmeticStore, pageRulesForHost, validateCosmeticStore, type CosmeticStore } from "./cosmetic-store";
import { buildCosmeticStyle } from "../content/cosmetic-style";

// Simulate an already persisted subscription generation without any built-ins.
function legacyStore(): CosmeticStore {
  return { version: 2, generation: 1, ...compileCosmeticFilters("example.com##.remote-ad") };
}

const videoSelectors = [".ad-report.strip-ad", ".video-card-ad-small", ".ad-report.ad-floor-exp"];
const feedSelectors = BUNDLED_REPOSITORY_RULES.sites[0].selectors.filter((s) => s.includes(':has('));

describe("Bilibili bundled cosmetic rules", () => {
  it("adds all four placements even to an existing store without a subscription refresh", () => {
    const store = legacyStore();
    expect(validateCosmeticStore(store)).toBe(true);
    const rules = pageRulesForHost(store, "www.bilibili.com");
    expect(rules.selectors).toEqual(expect.arrayContaining([...videoSelectors, ...feedSelectors]));
    expect(rules.scriptlets).toEqual([]);
    expect(buildCosmeticStyle(rules.selectors)).toContain(feedSelectors[0]);
    expect(store.sites).toHaveLength(1);
  });

  it("keeps remote relational rules unsupported and the stored schema unchanged", () => {
    const remote = compileCosmeticFilters('www.bilibili.com##.bili-feed-card:has(a)');
    expect(remote.report.skipped).toBe(1);
    expect(remote.sites).toEqual([]);
    const store = createCosmeticStore("", 2);
    expect(validateCosmeticStore(store)).toBe(true);
    expect(store.sites.flatMap((site) => site.selectors).some((selector) => selector.includes(":has("))).toBe(false);
    const rules = pageRulesForHost(store, "www.bilibili.com");
    expect(new Set(rules.selectors).size).toBe(rules.selectors.length);
  });

  it.each(["example.com", "bilibili.com.example.org", "live.bilibili.com", "space.bilibili.com"])("does not target %s", (host) => {
    expect(pageRulesForHost(legacyStore(), host).selectors).not.toEqual(expect.arrayContaining(videoSelectors));
    expect(pageRulesForHost(legacyStore(), host).selectors.some((s) => s.includes("bili"))).toBe(false);
  });

  it("retains selector exceptions and does not enable rules without a store", () => {
    const store = createCosmeticStore("www.bilibili.com#@#.ad-report.strip-ad", 1);
    expect(pageRulesForHost(store, "www.bilibili.com").selectors).not.toContain(".ad-report.strip-ad");
    expect(pageRulesForHost(undefined, "www.bilibili.com").selectors).toEqual([]);
  });
});
