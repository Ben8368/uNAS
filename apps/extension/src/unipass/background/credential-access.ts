import { accountCatalog } from "../shared/api";
import type { AccountRef, VaultTarget } from "../shared/vault";
import { appUrlMatches, vaultTargetMatches } from "../shared/url";
import { targetsForAccountRef } from "./vault/vault-service";

/** Resolve ownership from the backend, never from caller-supplied directory metadata. */
export async function fillTargetForAccount(ref: AccountRef, pageUrl: string): Promise<{ expectedAppUrl: string; targets?: VaultTarget[] }> {
  if (ref.vaultId !== "legacy-unipass") {
    const targets = await targetsForAccountRef(ref);
    if (!targets.some((target) => vaultTargetMatches(target, pageUrl))) throw new Error("该账号不属于当前应用，已取消填充");
    return { expectedAppUrl: pageUrl, targets };
  }
  const catalog = await accountCatalog(pageUrl);
  if (!catalog.complete) throw new Error("无法完整验证账号所属应用，已取消填充");
  const entry = catalog.entries.find((candidate) => appUrlMatches(candidate.appUrl, pageUrl)
    && candidate.accounts.some((account) => String(account.id ?? account.accountId ?? account.appAccountUserId) === ref.accountId));
  if (!entry) throw new Error("该账号不属于当前应用，已取消填充");
  return { expectedAppUrl: entry.appUrl };
}

export function assertRevealSource(sender: chrome.runtime.MessageSender, ref?: AccountRef): asserts ref is AccountRef {
  const allowedPage = sender.url === chrome.runtime.getURL("passwords.html") || sender.url === chrome.runtime.getURL("popup.html");
  if (sender.id !== chrome.runtime.id || !allowedPage) {
    throw new Error("仅允许在扩展账号详情页查看密码");
  }
  if (!ref || ref.vaultId === "legacy-unipass") throw new Error("仅支持查看 WebDAV 账号密码");
}
