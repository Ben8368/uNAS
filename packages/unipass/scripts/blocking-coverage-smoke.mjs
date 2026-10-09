import assert from "node:assert/strict";

// Only this explicit test observes failed requests; production has no request listener.
export async function assertLiveBlockingCoverage(page, controlPage) {
  const probes = [
    "https://googleads.g.doubleclick.net/pagead/id",
    "https://www.google-analytics.com/analytics.js",
    "https://static.hotjar.com/c/hotjar-1.js",
  ];
  const failures = new Map();
  const onFailure = request => failures.set(request.url(), request.failure()?.errorText);
  page.on("requestfailed", onFailure);
  try {
    for (const url of probes) {
      await page.evaluate(async target => {
        try { await fetch(target, { mode: "no-cors", cache: "no-store", signal: AbortSignal.timeout(10_000) }); }
        catch { /* Inspect the browser's actual failure reason, not fetch's generic TypeError. */ }
      }, url);
      await page.waitForFunction(() => true);
      assert.equal(failures.get(url), "net::ERR_BLOCKED_BY_CLIENT", `${url} must be blocked by DNR, not DNS/CORS/network failure`);
    }
    const summary = await controlPage.evaluate(async () => {
      const rules = (await chrome.declarativeNetRequest.getDynamicRules()).filter(rule => rule.id >= 200_000_000);
      return { rules: rules.length, domains: rules.reduce((sum, rule) => sum + (rule.condition.requestDomains?.length ?? 0), 0) };
    });
    assert.ok(summary.domains > 50_000, "live global subscriptions must retain domain coverage after compaction");
    console.log(`Chrome coverage GREEN: ${summary.rules} DNR rules, ${summary.domains} domain entries; advertising, analytics and behavioral tracking blocked`);
  } finally { page.off("requestfailed", onFailure); }
}
