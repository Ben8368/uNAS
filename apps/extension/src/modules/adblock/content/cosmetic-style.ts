import { bilibiliLayoutStyle } from "./bilibili-layout";

export const COSMETIC_STYLE_ID_PREFIX = "unipass-cosmetic-style-";
const PROTECTED_TARGETS = `:not(input,textarea,select,form,button,[type="password" i],[autocomplete*="password" i],[contenteditable="true" i],[role="button" i],#unipass-page-overlay):not(:has(input,textarea,select,form,button,[type="password" i],[autocomplete*="password" i],[contenteditable="true" i],[role="button" i],#unipass-page-overlay))`;
const MAX_STYLE_BYTES = 300_000;

export function buildCosmeticStyle(selectors: string[]): string {
  const rules: string[] = [];
  for (const selector of [...new Set(selectors)]) {
    // NUL is explicitly rejected because selector text came from a remote list.
    // eslint-disable-next-line no-control-regex
    if (!selector || selector.length > 512 || /[{};<>\u0000]|(?:^|[\s>+~])(?:html|body|form|input|textarea|select|button)(?:[.#:[\s]|$)/i.test(selector)) continue;
    const rule = `:where(${selector})${PROTECTED_TARGETS}{display:none!important}`;
    if (new TextEncoder().encode(rule).byteLength > MAX_STYLE_BYTES - rules.reduce((sum, item) => sum + item.length, 0)) break;
    rules.push(rule);
  }
  return rules.join("\n");
}

export function installCosmeticStyle(documentRoot: Document, generation: number, selectors: string[]): boolean {
  const styleId = `${COSMETIC_STYLE_ID_PREFIX}${generation}`;
  const css = selectors.length && generation ? buildCosmeticStyle(selectors) + "\n" + bilibiliLayoutStyle(documentRoot.location.hostname, selectors) : "";
  const existing = documentRoot.getElementById(styleId);
  if (existing?.tagName === "STYLE" && existing.textContent === css) {
    documentRoot.querySelectorAll(`style[id^="${COSMETIC_STYLE_ID_PREFIX}"]`).forEach((node) => {
      if (node !== existing) node.remove();
    });
    return true;
  }
  documentRoot.querySelectorAll(`style[id^="${COSMETIC_STYLE_ID_PREFIX}"]`).forEach((node) => node.remove());
  if (!css) return true;
  const root = documentRoot.head ?? documentRoot.documentElement ?? documentRoot.body;
  if (!root) return false;
  const style = documentRoot.createElement("style");
  style.id = styleId;
  style.textContent = css;
  root.append(style);
  return true;
}

export function removeCosmeticStyles(documentRoot: Document): void {
  documentRoot.querySelectorAll(`style[id^="${COSMETIC_STYLE_ID_PREFIX}"]`).forEach((node) => node.remove());
}
