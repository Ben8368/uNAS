import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { LeftNavbar } from './LeftNavbar'

describe('LeftNavbar', () => {
  it('places the account control before settings and does not render a power control', () => {
    const markup = renderToStaticMarkup(<LeftNavbar />)

    expect(markup.indexOf('aria-label="账号"')).toBeLessThan(markup.indexOf('aria-label="设置"'))
    expect(markup).not.toContain('演示能力说明')
    expect(markup).toContain('cx="12" cy="12" r="9"')
  })
})
