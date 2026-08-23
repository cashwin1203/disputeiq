import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: "http://localhost:3107", trace: "retain-on-failure" },
  webServer: { command: "npm run start -- -p 3107", url: "http://localhost:3107", reuseExistingServer: false },
  projects: [{ name: "chrome", use: { ...devices["Desktop Chrome"], channel: "chrome" } }],
});
