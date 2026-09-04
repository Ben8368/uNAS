export function fitWindow(bounds: { width: number; height: number; x: number; y: number }, viewport: { width: number; height: number }) {
  const availableWidth = Math.max(1, viewport.width)
  const availableHeight = Math.max(1, viewport.height)
  const width = Math.min(availableWidth, Math.max(Math.min(760, availableWidth), bounds.width))
  const height = Math.min(availableHeight, Math.max(Math.min(320, availableHeight), bounds.height))
  return { width, height, x: Math.min(Math.max(0, bounds.x), availableWidth - width), y: Math.min(Math.max(0, bounds.y), availableHeight - height) }
}
