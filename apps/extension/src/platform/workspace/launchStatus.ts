let error = ''
const listeners = new Set<() => void>()
export const launchStatus = {
  getSnapshot: () => error,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
  set(message: string) { error = message; listeners.forEach((listener) => listener()) },
}
