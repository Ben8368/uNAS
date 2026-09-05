import { defineConfig } from '@playwright/test'

const port = Number(process.env.UNAS_WEB_TEST_PORT || 15173)
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './e2e-web',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  workers: 1,
  retries: 0,
  use: { baseURL, channel: 'chromium', viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure' },
  reporter: [['list']],
  outputDir: './test-results/web-e2e',
  webServer: { command: `pnpm exec vite --host 127.0.0.1 --port ${port} --strictPort`, url: baseURL, reuseExistingServer: false },
})
