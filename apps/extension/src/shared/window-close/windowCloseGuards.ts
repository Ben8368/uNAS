type CloseGuard = () => boolean
const guards = new Map<string, Set<CloseGuard>>()

export function registerWindowCloseGuard(id: string, guard: CloseGuard) {
  const registered = guards.get(id) ?? new Set<CloseGuard>()
  registered.add(guard)
  guards.set(id, registered)
  return () => {
    registered.delete(guard)
    if (!registered.size) guards.delete(id)
  }
}

export function canCloseWindow(id: string) {
  for (const guard of guards.get(id) ?? []) if (!guard()) return false
  return true
}
