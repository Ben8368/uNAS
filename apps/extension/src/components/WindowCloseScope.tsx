import { createContext, useContext, useLayoutEffect } from 'react'
import { registerWindowCloseGuard } from 'unas-src/windowCloseGuards'

export const WindowCloseScope = createContext<string | undefined>(undefined)

export function useWindowCloseGuard(guard: () => boolean) {
  const windowId = useContext(WindowCloseScope)
  useLayoutEffect(() => windowId ? registerWindowCloseGuard(windowId, guard) : undefined, [windowId, guard])
}
