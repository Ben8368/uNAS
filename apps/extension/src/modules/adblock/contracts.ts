export const BLOCKING_RECONCILE_ALARM = "unipass-blocking-reconcile";
// Reserved by the previous site-whitelist implementation; used only for migration.
export const BLOCKING_DYNAMIC_RULE_ID_BASE = 1_000_000;
export const BLOCKING_DYNAMIC_RULE_ID_LIMIT = 101_000_000;
export const LEGACY_BLOCKING_STORAGE_KEYS = ["unipass_blocking_enabled", "unipass_blocking_whitelist"];
export const BLOCKING_PAUSE_STORAGE_KEY = "unipass_blocking_paused_sites";
export const BLOCKING_PAUSE_RULE_ID_BASE = 110_000_000;
export const BLOCKING_PAUSE_RULE_ID_LIMIT = 110_010_000;
export const BASELINE_RULE_COUNT = 26;
export type BlockingState = "baseline-only" | "ready" | "stale" | "error";
export interface BlockingStatus {
  enabled: true;
  state: BlockingState;
  ready: boolean;
  ruleCount: number;
  baselineRuleCount: number;
  updatedAt?: number;
  error?: string;
}
