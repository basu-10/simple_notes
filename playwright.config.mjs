import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const www = join(root, "..", "www");

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:5188",
    trace: "on-first-retry"
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } }
  ],
  webServer: {
    command: "node tests/e2e/server.mjs",
    url: "http://127.0.0.1:5188/app.html",
    reuseExistingServer: !process.env.CI,
    timeout: 20000
  }
});
