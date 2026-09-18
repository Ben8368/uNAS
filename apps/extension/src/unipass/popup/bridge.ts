import type { BackgroundRequest, BackgroundResponse } from "../shared/types";

let overlayToken: string | undefined;

export function setOverlayToken(token?: string): void {
  overlayToken = token;
}

export async function send<T>(message: BackgroundRequest): Promise<T> {
  const routedMessage = overlayToken && !message.overlayToken ? { ...message, overlayToken } : message;
  const response = await chrome.runtime.sendMessage<BackgroundRequest, BackgroundResponse<T>>(routedMessage);
  if (!response?.ok) throw new Error(response?.error || "扩展后台没有响应");
  return response.data;
}
