// Playwright configuration for the Movie Night UI test suite.
//
// The suite runs against the real app + real backend. Two servers are stood
// up by Playwright's `webServer`:
//   1. the Vite dev server (the app, in browser/web mode)
//   2. the movienight Node media server, pointed at committed e2e fixtures
//
// Browsers: this machine is macOS 13, which current Playwright Chromium
// builds no longer support, so we drive the system Google Chrome via
// `channel: "chrome"` instead (no browser download needed).

const path = require("node:path");

const { defineConfig, devices } = require("@playwright/test");

const appDir = __dirname;
const repoRoot = path.resolve(appDir, "..");

const APP_PORT = 5273;
const API_PORT = 8791;
const APP_URL = `http://127.0.0.1:${APP_PORT}`;
const API_URL = `http://127.0.0.1:${API_PORT}`;

module.exports = defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL: APP_URL,
    channel: "chrome",
    headless: true,
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"],
    },
  },
  webServer: [
    {
      command: `npm run web -- --port ${APP_PORT} --strictPort --host 127.0.0.1`,
      cwd: appDir,
      url: APP_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: "node server/src/index.js",
      cwd: repoRoot,
      env: {
        MOVIE_DIR: path.join(appDir, "e2e", "fixtures", "movies"),
        DATA_DIR: path.join(appDir, "e2e", "fixtures", ".data"),
        PORT: String(API_PORT),
        HOST: "127.0.0.1",
        TMDB_API_KEY: "",
      },
      url: `${API_URL}/api/healthz`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});

module.exports.APP_PORT = APP_PORT;
module.exports.API_PORT = API_PORT;
module.exports.APP_URL = APP_URL;
module.exports.API_URL = API_URL;