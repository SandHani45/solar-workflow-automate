import { defineConfig, devices } from '@playwright/test';

/**
 * - `e2e`    — real journeys against a running stack (web + API + seeded DB). Run with `pnpm test:e2e`.
 * - `mocked` — UI checks with the API mocked in-browser (e2e/fixtures/mock-api.ts); no backend needed.
 *
 * BASE_URL defaults to http://localhost:3000. Set E2E_START_SERVER=1 to have Playwright start
 * `pnpm start` (requires a prior `pnpm build`).
 */
const baseURL = process.env.BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'e2e', testIgnore: /mocked\//, use: { ...devices['Desktop Chrome'] } },
    { name: 'mocked', testMatch: /mocked\/.*\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: process.env.E2E_START_SERVER ? { command: 'pnpm start', url: baseURL, reuseExistingServer: true, timeout: 120_000 } : undefined,
});
