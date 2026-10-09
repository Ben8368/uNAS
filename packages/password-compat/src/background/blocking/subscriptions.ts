export const FILTER_SUBSCRIPTIONS = [
  {
    id: "easylist",
    homepage: "https://easylist.to/",
    url: "https://easylist-downloads.adblockplus.org/easylist.txt",
  },
  {
    id: "easyprivacy",
    homepage: "https://easylist.to/",
    url: "https://easylist-downloads.adblockplus.org/easyprivacy.txt",
  },
  {
    id: "easylist-china",
    homepage: "https://github.com/easylist/easylistchina/",
    url: "https://easylist-downloads.adblockplus.org/easylistchina.txt",
  },
  {
    id: "anti-cv",
    homepage: "https://gitlab.com/eyeo/anti-cv/abp-filters-anti-cv",
    url: "https://easylist-downloads.adblockplus.org/abp-filters-anti-cv.txt",
  },
] as const;
export const FILTER_UPDATE_ALARM = "unipass-filter-update";
export const FILTER_UPDATE_STORAGE_KEY = "unipass_filter_update";
export const FILTER_UPDATE_INTERVAL_MS = 60 * 60 * 1000;
export const FILTER_RULE_ID_BASE = 200_000_000;
export const FILTER_RULE_LIMIT = 30_000;
// Bump when the subscription set or compiler changes; do not reuse a fresh older generation.
export const FILTER_GENERATION = 3;
