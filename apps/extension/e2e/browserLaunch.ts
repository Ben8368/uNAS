import type { BrowserContextOptions } from '@playwright/test'

const colorProfiles = new Set(['srgb', 'display-p3', 'scrgb-linear', 'rec2020', 'hdr10'])

export function extensionBrowserOptions(extensionPath: string): BrowserContextOptions {
  const headed = process.env.UNAS_E2E_HEADED === '1'
  const requestedBrowser = process.env.UNAS_E2E_BROWSER
  // Extension E2E relies on Playwright's bundled Chromium for deterministic
  // MV3 service-worker loading. Use system Chrome only for explicit P3 runs.
  const browserChannel: 'chrome' | 'chromium' = requestedBrowser === 'chrome' ? 'chrome' : 'chromium'
  const requestedProfile = process.env.UNAS_E2E_COLOR_PROFILE
  const colorProfile = requestedProfile && colorProfiles.has(requestedProfile) ? requestedProfile : undefined

  return {
    channel: browserChannel,
    headless: !headed,
    viewport: { width: 1440, height: 900 },
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--enable-unsafe-extension-debugging',
      ...(colorProfile ? [`--force-color-profile=${colorProfile}`] : []),
    ],
  }
}

export function extensionBrowserEnvironment() {
  const headed = process.env.UNAS_E2E_HEADED === '1'
  const requestedProfile = process.env.UNAS_E2E_COLOR_PROFILE
  const colorProfile = requestedProfile && colorProfiles.has(requestedProfile) ? requestedProfile : 'srgb'
  return { headless: !headed, colorProfile }
}
