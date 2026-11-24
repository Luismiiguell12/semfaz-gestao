import { defineConfig, devices } from "@playwright/test";

// E2E contra o build estático (como no GitHub Pages) e o Supabase local.
const PORT = 4173;
const baseURL = `http://localhost:${PORT}/semfaz-gestao/`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL,
    locale: "pt-BR",
    timezoneId: "America/Maceio",
    trace: "off",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 860 } } },
    { name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 820, height: 1180 }, hasTouch: true } },
    { name: "celular", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "node scripts/serve-static.mjs",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(PORT) },
  },
});
