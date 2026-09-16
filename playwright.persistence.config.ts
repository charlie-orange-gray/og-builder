import { defineConfig, devices } from '@playwright/test';

// A real API/PostgreSQL proof, separate from standalone canvas E2E fixtures.
export default defineConfig({
  testDir: './tests/persistence',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [['list'], ['json', { outputFile: 'test-results/persistence-report.json' }]],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:4334',
    viewport: { width: 1600, height: 1000 },
    actionTimeout: 20_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'npm --prefix ../og-control-plane run dev:local',
      env: { OG_LOCAL_DATA_ROOT: '.data/phase1-proof-v1', PORT: '8091', OG_PG_PORT: '55433' },
      url: 'http://127.0.0.1:8091/healthz',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npx vite --port 4334 --strictPort',
      env: {
        VITE_REVYME_CLOUD: 'false',
        VITE_SELF_HOSTED_PERSISTENCE: 'true',
        VITE_SELF_HOSTED_PUBLISH: 'false',
        VITE_API_URL: 'http://127.0.0.1:8091',
      },
      url: 'http://localhost:4334',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npx vite --config vite.sandbox.config.ts',
      url: 'http://localhost:5174',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
