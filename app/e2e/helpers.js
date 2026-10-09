// Shared helpers for the Movie Night E2E / UI suite.
// CommonJS to match the app package (no "type": "module").

const { expect } = require("@playwright/test");

const API_URL = "http://127.0.0.1:8791";

// Clear every favourite on the backend so tests start from a known state.
// The server keeps favourites in memory, so this must go through the API.
async function resetFavorites() {
  const res = await fetch(`${API_URL}/api/movies`);
  const { movies } = await res.json();
  await Promise.all(
    movies.map((m) =>
      fetch(`${API_URL}/api/movies/${m.id}/favorite`, { method: "DELETE" })
    )
  );
}

// Load the app and stop on the home (connect) screen.
async function gotoHome(page) {
  await page.goto("/");
  await expect(page.locator(".connect-screen")).toBeVisible();
}

// Drive the "Connect to a server" form and wait for the library to load.
async function connectToServer(page, url = API_URL) {
  await page.fill(".url-input", url);
  await page.click('.connect-panels button[type="submit"]');
  await expect(page.locator(".topbar")).toBeVisible();
  await expect(page.locator(".grid .card").first()).toBeVisible();
}

// Full setup used by most in-app tests.
async function openLibrary(page) {
  await resetFavorites();
  await gotoHome(page);
  await connectToServer(page);
}

const VIEW_LABELS = ["Films", "Series", "Favorites", "Newly Added"];

async function openMenu(page) {
  await page.click(".hamburger");
  await expect(page.locator(".hamburger-menu")).toBeVisible();
}

async function selectView(page, label) {
  await openMenu(page);
  await page.click(`.menu-item:has-text("${label}")`);
  await expect(page.locator(".hamburger-menu")).toHaveCount(0);
}

// Play/pause state of the player video.
function videoPaused(page) {
  return page.evaluate(() => {
    const v = document.querySelector("video.player-video");
    return v ? v.paused : null;
  });
}

module.exports = {
  API_URL,
  VIEW_LABELS,
  resetFavorites,
  gotoHome,
  connectToServer,
  openLibrary,
  openMenu,
  selectView,
  videoPaused,
};
