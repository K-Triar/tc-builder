import { defineConfig, devices } from '@playwright/test';

const port = 4173;
const url = `http://localhost:${port}/tc-builder/`;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: url,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'pc', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 740 }, hasTouch: true },
    },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${port} --strictPort`,
    url,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
