import type { BackgroundRequest, BackgroundResponse } from "../shared/types";
import type { AdBlockRequest } from "../../../shared/adblock-messages";

let overlayToken: string | undefined;

export function setOverlayToken(token?: string): void {
  overlayToken = token;
}

export async function send<T>(message: BackgroundRequest | AdBlockRequest): Promise<T> {
  const routedMessage = overlayToken && (!('overlayToken' in message) || !message.overlayToken) ? { ...message, overlayToken } : message;
  const response = await chrome.runtime.sendMessage(routedMessage) as BackgroundResponse<T>;
  if (!response?.ok) throw new Error(response?.error || "扩展后台没有响应");
  return response.data;
}
