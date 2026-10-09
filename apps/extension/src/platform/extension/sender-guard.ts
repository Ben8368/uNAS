export interface SenderLike {
  id?: string;
  url?: string;
  frameId?: number;
  tab?: { id?: number };
  documentId?: string;
}

export function isExtensionPageSender(sender: SenderLike, extensionId: string, allowedPaths: readonly string[]): boolean {
  if (sender.id !== extensionId || (sender.frameId !== undefined && sender.frameId !== 0)) return false;
  try {
    const url = new URL(sender.url || "");
    return url.protocol === "chrome-extension:"
      && url.host === extensionId
      && allowedPaths.includes(url.pathname);
  } catch {
    return false;
  }
}

export function isWebPageSender(sender: SenderLike, extensionId: string, allowChildFrame = false): boolean {
  if (sender.id !== extensionId || (!allowChildFrame && sender.frameId !== undefined && sender.frameId !== 0)) return false;
  try {
    const url = new URL(sender.url || "");
    return (url.protocol === "http:" || url.protocol === "https:")
      && Number.isInteger(sender.tab?.id);
  } catch {
    return false;
  }
}
