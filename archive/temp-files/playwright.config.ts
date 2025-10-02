import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'https://devtest.comda.co.il/',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // webServer configuration disabled - testing external WeSign application
  // webServer: {
  //   command: 'cd playwright-smart && npm run dev',
  //   port: 3003,
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120 * 1000,
  // },
});