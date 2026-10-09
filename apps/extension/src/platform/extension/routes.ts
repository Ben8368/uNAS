import type { extensionApi, ExtensionMessageSender } from './extensionPlatform'

export type RuntimeResponse = { ok: false; error: string } | { ok: true; links?: unknown; downloadId?: number; trackingWarning?: string; download?: unknown; downloads?: unknown[]; items?: unknown[] }
export type RouteRuntime = NonNullable<NonNullable<ReturnType<typeof extensionApi>>['runtime']>

/** One routable message kind: match -> authorize -> dispatch. The router owns ordering and response normalization. */
export type MessageRoute = {
  matches(message: unknown): boolean
  authorize(sender: ExtensionMessageSender, extensionId: string, message: unknown): boolean
  /** Present: a matching but unauthorized message is answered with this error. Absent: it falls through to later routes. */
  rejection?: string
  handle(message: unknown, sender: ExtensionMessageSender, runtime: RouteRuntime): unknown | Promise<unknown>
}

export function defineRoute<M>(route: {
  matches(message: unknown): message is M
  authorize(sender: ExtensionMessageSender, extensionId: string, message: unknown): boolean
  rejection?: string
  handle(message: M, sender: ExtensionMessageSender, runtime: RouteRuntime): unknown | Promise<unknown>
}): MessageRoute {
  return route as MessageRoute
}
