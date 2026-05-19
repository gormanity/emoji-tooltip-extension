import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  reporter: process.env.CI ? "github" : "list",
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  use: {
    trace: "retain-on-failure",
  },
});
