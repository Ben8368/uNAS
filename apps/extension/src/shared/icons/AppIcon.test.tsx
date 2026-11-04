import type { SyntheticEvent } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AppIcon } from './AppIcon'
import { APP_ICON_PATHS, FALLBACK_ICON } from './appIcons'

describe('AppIcon', () => {
  it.each(['desktop', 'launcher', 'dock', 'window'] as const)('uses one decorative image on %s', (variant) => {
    const markup = renderToStaticMarkup(<AppIcon src={APP_ICON_PATHS.music} variant={variant} />)
    expect(markup).toContain('alt=""')
    expect(markup).toContain('draggable="false"')
    expect(markup).toContain('app-icon-img--' + variant)
    expect(markup).toContain(APP_ICON_PATHS.music)
  })

  it('supports an accessible name when used without an adjacent label', () => {
    expect(renderToStaticMarkup(<AppIcon src={APP_ICON_PATHS.music} alt="音乐" />)).toContain('alt="音乐"')
  })

  it('tries the shared fallback once, even when the fallback cannot load', () => {
    const element = AppIcon({ src: '/missing.svg' })
    let src = '/missing.svg'
    let writes = 0
    const image = { getAttribute: () => src, set src(value: string) { src = value; writes++ } }
    const event = { currentTarget: image } as unknown as SyntheticEvent<HTMLImageElement>
    element.props.onError(event)
    expect(src).toBe(FALLBACK_ICON)
    element.props.onError(event)
    expect(writes).toBe(1)
    expect(AppIcon({ src: APP_ICON_PATHS.music }).key).toBe(APP_ICON_PATHS.music)
  })
})
