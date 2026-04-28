import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/visual",
  snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}",
  timeout: 30_000,
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.015
    }
  },
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry"
  },
  webServer: {
    command: "npm start",
    url: "http://127.0.0.1:4173/app.html",
    reuseExistingServer: !process.env.CI,
    timeout: 10_000
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1200 } }
    },
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 7"], viewport: { width: 412, height: 915 } }
    }
  ],
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list"
});
