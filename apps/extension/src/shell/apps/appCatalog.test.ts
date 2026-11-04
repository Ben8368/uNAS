import { describe, expect, it } from 'vitest'
import { APP_CATALOG, appCatalog, getAppMetadata, getLauncherApps } from './appCatalog'
import { appRegistry, getRegisteredApp } from './appRegistry'

describe('App catalog and implementation composition', () => {
  it('has unique stable IDs, matching keys and a lazy implementation for every entry', () => {
    expect(new Set(appCatalog.map((app) => app.id)).size).toBe(appCatalog.length)
    expect(appRegistry.map((app) => app.id)).toEqual(appCatalog.map((app) => app.id))
    for (const [id, app] of Object.entries(APP_CATALOG)) {
      expect(app.id).toBe(id)
      expect(getAppMetadata(id)).toBe(app)
      expect(app).not.toHaveProperty('component')
      expect(getRegisteredApp(id)).toMatchObject(app)
      expect(getRegisteredApp(id)?.component).toHaveProperty('$$typeof', Symbol.for('react.lazy'))
    }
  })

  it('preserves desktop order and excludes settings and hidden logs from the launcher', () => {
    expect(getLauncherApps().map((app) => app.id)).toEqual(['browser', 'file-manager', 'fetcher', 'password-manager', 'adblock', 'music'])
    expect(getRegisteredApp('file-manager')?.headerStatus).toBeDefined()
    expect(getRegisteredApp('settings')?.headerStatus).toBeDefined()
    expect(getRegisteredApp('logs')).toBeDefined()
  })

  it.each(['', 'missing', '__proto__', 'constructor'])('rejects an unknown ID: %s', (id) => {
    expect(getAppMetadata(id)).toBeUndefined()
    expect(getRegisteredApp(id)).toBeUndefined()
  })
})
