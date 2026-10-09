import type { CosmeticScriptlet, PageCosmeticRules } from "../engine/cosmetic-store";
import { installCosmeticStyle, removeCosmeticStyles } from "./cosmetic-style";

const MAX_MUTATION_RUNS_PER_SECOND = 4;
let scriptletCleanup: (() => void) | undefined;
let syncTimer: number | undefined;
let syncInFlight = false;
let syncQueued = false;
let activeScriptletKey = "";

void syncCosmeticRules();
// document_start may run before the parser creates <html>; retry once the
// document has a usable root instead of losing the first cosmetic sync.
document.addEventListener("DOMContentLoaded", scheduleSync, { once: true, passive: true });
document.addEventListener("readystatechange", scheduleSync, { passive: true });
for (const eventName of ["popstate", "hashchange"]) window.addEventListener(eventName, scheduleSync, { passive: true });
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;
history.pushState = function (...args: Parameters<History["pushState"]>) { const result = originalPushState.apply(this, args); scheduleSync(); return result; };
history.replaceState = function (...args: Parameters<History["replaceState"]>) { const result = originalReplaceState.apply(this, args); scheduleSync(); return result; };

chrome.runtime.onMessage.addListener((message: unknown) => {
  if (!message || typeof message !== "object") return;
  if ((message as { type?: string }).type === "clearCosmeticEffects") { clearEffects(); scheduleSync(); }
  if ((message as { type?: string }).type === "refreshCosmeticEffects") scheduleSync();
});

function scheduleSync(): void {
  if (syncTimer != null) window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => void syncCosmeticRules(), 50);
}

async function syncCosmeticRules(): Promise<void> {
  if (syncInFlight) { syncQueued = true; return; }
  if (!/^https?:$/.test(location.protocol)) return;
  if (!document.documentElement) { scheduleSync(); return; }
  syncInFlight = true;
  try {
    const response = await chrome.runtime.sendMessage({ type: "getCosmeticRules" });
    if (!response?.ok) return;
    const rules = response.data as PageCosmeticRules;
    if (!installCosmeticStyle(document, rules.generation, Array.isArray(rules.selectors) ? rules.selectors : [])) {
      scheduleSync();
      return;
    }
    const scriptlets = Array.isArray(rules.scriptlets) ? rules.scriptlets : [];
    const scriptletKey = scriptlets.map((scriptlet) => `${scriptlet.name}\u001f${scriptlet.args.join("\u001f")}`).join("\u001e");
    if (scriptletKey !== activeScriptletKey) {
      scriptletCleanup?.();
      scriptletCleanup = applyScriptlets(scriptlets);
      activeScriptletKey = scriptletKey;
    }
  } catch {
    // Browser-internal pages and frames without host access simply remain unchanged.
  } finally {
    syncInFlight = false;
    if (syncQueued) { syncQueued = false; scheduleSync(); }
  }
}

function clearEffects(): void {
  removeCosmeticStyles(document);
  scriptletCleanup?.();
  scriptletCleanup = undefined;
  activeScriptletKey = "";
}

function applyScriptlets(scriptlets: CosmeticScriptlet[]): () => void {
  const operations = [...new Map(scriptlets.filter((scriptlet) => scriptlet.name === "remove-attr" && scriptlet.args.length === 2)
    .map((scriptlet) => [`${scriptlet.args[0]}\u001f${scriptlet.args[1]}`, { selector: scriptlet.args[0], attribute: scriptlet.args[1] }])).values()];
  if (!operations.length) return () => {};
  const original = new Map<Element, Map<string, string | null>>();
  let runs = 0;
  let windowStart = Date.now();
  const withinBudget = (): boolean => {
    const now = Date.now();
    if (now - windowStart >= 1_000) { windowStart = now; runs = 0; }
    if (runs >= MAX_MUTATION_RUNS_PER_SECOND) return false;
    runs += 1;
    return true;
  };
  const remove = (element: Element, attribute: string): void => {
    const attributes = original.get(element) ?? new Map<string, string | null>();
    if (!element.hasAttribute(attribute)) return;
    if (!attributes.has(attribute)) {
      attributes.set(attribute, element.getAttribute(attribute));
      original.set(element, attributes);
    }
    element.removeAttribute(attribute);
  };
  const applyToRoots = (roots: Iterable<ParentNode>): void => {
    try {
      for (const root of roots) for (const operation of operations) {
        if (root instanceof Element && root.matches(operation.selector)) remove(root, operation.attribute);
        root.querySelectorAll(operation.selector).forEach((element) => remove(element, operation.attribute));
      }
    } catch { /* The selector was validated in the Service Worker; DOM quirks still fail closed. */ }
  };
  if (withinBudget()) applyToRoots([document]);
  const pendingRoots = new Set<ParentNode>();
  let mutationTimer: number | undefined;
  const flushMutations = (): void => {
    mutationTimer = undefined;
    if (!pendingRoots.size || !withinBudget()) return;
    const roots = [...pendingRoots];
    pendingRoots.clear();
    applyToRoots(roots);
  };
  const scheduleMutationFlush = (): void => {
    if (mutationTimer == null) mutationTimer = window.setTimeout(flushMutations, 0);
  };
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes" && mutation.target instanceof Element) {
        try {
          for (const operation of operations) {
            if (operation.attribute === mutation.attributeName && mutation.target.hasAttribute(operation.attribute)
              && mutation.target.matches(operation.selector)) pendingRoots.add(mutation.target);
          }
        } catch { /* The selector was validated in the Service Worker; DOM quirks still fail closed. */ }
      } else if (mutation.type === "childList") {
        for (const node of mutation.addedNodes) if (node instanceof Element) pendingRoots.add(node);
      }
    }
    scheduleMutationFlush();
  });
  observer.observe(document.documentElement, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: [...new Set(operations.map((operation) => operation.attribute))],
  });
  return () => {
    observer.disconnect();
    if (mutationTimer != null) window.clearTimeout(mutationTimer);
    for (const [element, attributes] of original) for (const [attribute, value] of attributes) {
      if (element.isConnected && value !== null && !element.hasAttribute(attribute)) element.setAttribute(attribute, value);
    }
  };
}
