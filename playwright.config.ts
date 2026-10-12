import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// This session's sandbox ships a pre-installed Chromium at a fixed path
// (see the environment's README); a normal CI runner has none of that and
// should use Playwright's own managed browser install instead.
const SANDBOX_CHROMIUM = "/opt/pw-browsers/chromium";
const executablePath = existsSync(SANDBOX_CHROMIUM) ? SANDBOX_CHROMIUM : undefined;

export default defineConfig({
  testDir: "./e2e",
  // Deletes the suite's own "E2E …" rows before and after the run.
  globalSetup: "./test-support/e2eGlobal.ts",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: executablePath ? { executablePath } : {},
      },
    },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
