import { describe, expect, it } from 'vitest'
import { fitWindow } from './windowGeometry'

describe('window recovery after zoom or viewport shrink', () => {
  it('keeps all controls visible after shrinking below the desktop minimum', () => {
    expect(fitWindow({ width: 960, height: 640, x: 1600, y: -60 }, { width: 320, height: 480 }))
      .toEqual({ width: 320, height: 480, x: 0, y: 0 })
  })
  it('recovers a window dragged past any desktop edge', () => {
    expect(fitWindow({ width: 800, height: 500, x: -900, y: 2000 }, { width: 1400, height: 900 }))
      .toEqual({ width: 800, height: 500, x: 0, y: 400 })
  })
})
