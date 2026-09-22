export type AdBlockRequest =
  | { type: "getBlockingStatus" }
  | { type: "refreshBlockingSubscriptions" }
  | { type: "getBlockingSiteState" }
  | { type: "pauseBlockingForSite"; tabId?: number }
  | { type: "resumeBlockingForSite"; tabId?: number }
  | { type: "getCosmeticRules" };
