import { defineConfig, devices } from '@playwright/test'

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [['html'], ['list']],

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:5173',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Video on failure */
    video: 'retain-on-failure',

    /* Environment variables for E2E tests - use local Supabase */
    contextOptions: {
      // Ensure tests use local Supabase environment
      storageState: undefined, // Start with clean state
    },
  },

  /* Global environment setup */
  globalSetup: undefined, // Could add Supabase check here if needed

  /* Configure projects for major browsers */
  projects: [
    /* Audio tools (tuner fake mic, metronome drift): Chromium only, run with
       `--project=tools`. Specs set their own fake-mic launch args. */
    {
      name: 'tools',
      testMatch: /tools\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--autoplay-policy=no-user-gesture-required',
          ],
        },
      },
    },

    {
      name: 'chromium',
      testIgnore: /tools\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        // Add chromium-specific args to fix CORS issues in tests
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
          ],
        },
      },
    },

    {
      name: 'firefox',
      testIgnore: /tools\/.*\.spec\.ts/,
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      testIgnore: /tools\/.*\.spec\.ts/,
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      testIgnore: /tools\/.*\.spec\.ts/,
      use: {
        ...devices['Pixel 5'],
        // Add chromium-specific args to fix CORS issues in tests
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
          ],
        },
      },
    },
    {
      name: 'Mobile Safari',
      testIgnore: /tools\/.*\.spec\.ts/,
      use: { ...devices['iPhone 12'] },
    },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    // CRITICAL: Reuse existing server locally to avoid crashes from multiple instances
    // In CI, always start fresh to ensure clean state
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 120 seconds
  },
})
