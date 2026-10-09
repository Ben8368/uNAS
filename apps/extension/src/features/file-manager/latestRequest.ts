/** Shared ownership for navigation, initialization and view changes. */
export class LatestRequest {
  private controller?: AbortController
  private generation = 0

  invalidate() {
    this.controller?.abort()
    this.generation += 1
  }

  begin() {
    this.invalidate()
    this.controller = new AbortController()
    const generation = this.generation
    const signal = this.controller.signal
    return { signal, isCurrent: () => generation === this.generation && !signal.aborted }
  }

  checkpoint() {
    const generation = this.generation
    return () => generation === this.generation
  }
}
