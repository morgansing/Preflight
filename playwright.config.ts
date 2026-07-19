import { defineConfig } from "@playwright/test";

/**
 * E2E golden paths — the five flows that ARE the product. `npm run e2e`
 * boots the dev server itself; CI runs these on every push so the demo
 * world, launcher, filters, and share loop can't silently regress.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // the live harness is one-run-at-a-time by design
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: "http://localhost:3100",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    // Sandboxed/dev environments can point at a system Chromium.
    launchOptions: process.env.PW_CHROMIUM
      ? { executablePath: process.env.PW_CHROMIUM }
      : {},
  },
  webServer: {
    command: "PORT=3100 npm run dev",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
