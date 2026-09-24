import { chromium } from '@playwright/test'

const colorProfiles = new Set(['srgb', 'display-p3', 'scrgb-linear', 'rec2020', 'hdr10'])

export function extensionBrowserOptions(extensionPath: string): NonNullable<Parameters<typeof chromium.launchPersistentContext>[1]> {
  const headed = process.env.UNAS_E2E_HEADED === '1'
  const requestedBrowser = process.env.UNAS_E2E_BROWSER
  // Extension E2E defaults to bundled Chromium for deterministic MV3
  // service-worker loading; system Chrome is opt-in for target-browser checks.
  const browserChannel: 'chrome' | 'chromium' = requestedBrowser === 'chrome' ? 'chrome' : 'chromium'
  const requestedProfile = process.env.UNAS_E2E_COLOR_PROFILE
  const colorProfile = requestedProfile && colorProfiles.has(requestedProfile) ? requestedProfile : 'srgb'

  return {
    channel: browserChannel,
    headless: !headed,
    viewport: { width: 1440, height: 900 },
    ...(browserChannel === 'chrome' ? { ignoreDefaultArgs: ['--disable-extensions'] } : {}),
    args: [
      ...(browserChannel === 'chrome' ? [] : [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]),
      '--enable-unsafe-extension-debugging',
      `--force-color-profile=${colorProfile}`,
    ],
  }
}

export function extensionBrowserEnvironment() {
  const headed = process.env.UNAS_E2E_HEADED === '1'
  const channel = process.env.UNAS_E2E_BROWSER === 'chrome' ? 'chrome' : 'chromium'
  const requestedProfile = process.env.UNAS_E2E_COLOR_PROFILE
  const colorProfile = requestedProfile && colorProfiles.has(requestedProfile) ? requestedProfile : 'srgb'
  return { channel, headless: !headed, colorProfile, extensionLoadMethod: channel === 'chrome' ? 'CDP Extensions.loadUnpacked in isolated profile; setup session detached' : 'Chromium command-line unpacked extension' }
}

/** Test-only loading; never attach to a user's existing browser/profile.
 * Chrome no longer accepts the sideloading flags used by bundled Chromium.
 * CDP setup runs over Playwright's pipe, then detaches before assertions.
 */
export async function launchExtensionContext(extensionPath: string, profilePath = '') {
  const context = await chromium.launchPersistentContext(profilePath, extensionBrowserOptions(extensionPath))
  try {
    if (process.env.UNAS_E2E_BROWSER === 'chrome') {
      const session = await context.browser()!.newBrowserCDPSession()
      let id: string
      try { ({ id } = await session.send('Extensions.loadUnpacked', { path: extensionPath })) }
      finally { await session.detach() }
      // Wait for the installed worker without warming an extension page. Cold
      // startup tests must retain control over the first New Tab navigation.
      if (!context.serviceWorkers().some(worker => worker.url().startsWith('chrome-extension://' + id + '/'))) {
        await context.waitForEvent('serviceworker', { predicate: worker => worker.url().startsWith('chrome-extension://' + id + '/'), timeout: 15_000 })
      }
    }
    return context
  } catch (error) {
    await context.close()
    throw error
  }
}
