import { describe, expect, it } from 'vitest'
import { LatestRequest } from './latestRequest'

describe('navigation request ownership', () => {
  it('does not commit an old response after the latest directory completes', async () => {
    const requests = new LatestRequest()
    let releaseOld!: (path: string) => void
    let visible = ''
    const old = requests.begin()
    const first = new Promise<string>((resolve) => { releaseOld = resolve }).then((path) => {
      if (old.isCurrent()) visible = path
    })
    const latest = requests.begin()
    await Promise.resolve('/new').then((path) => { if (latest.isCurrent()) visible = path })
    releaseOld('/old')
    await first
    expect(visible).toBe('/new')
    expect(old.signal.aborted).toBe(true)
  })

  it('invalidates delayed initialization and responses when switching to trash or closing', () => {
    const requests = new LatestRequest()
    const initialization = requests.checkpoint()
    const directory = requests.begin()
    expect(initialization()).toBe(false)
    requests.invalidate()
    expect(directory.isCurrent()).toBe(false)
    expect(directory.signal.aborted).toBe(true)
  })
})
