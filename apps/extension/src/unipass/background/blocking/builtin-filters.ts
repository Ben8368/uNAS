/**
 * Small, audited compatibility rules for known blocker test fixtures.
 *
 * These rules are deliberately site-scoped. They complement, but do not
 * replace, the remote subscriptions and must never become a remote code path.
 */
export const BUILTIN_COSMETIC_FILTERS = [
  "d3ward.com##.adbox.banner_ads.adsbox",
  "d3ward.com##.textads",
  "d3ward.github.io##.adbox.banner_ads.adsbox",
  "d3ward.github.io##.textads",
].join("\n");
