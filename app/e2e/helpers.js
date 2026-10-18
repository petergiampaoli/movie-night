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

// Clear every watchlist entry so tests start from a known state.
async function resetWatchlist() {
  const res = await fetch(`${API_URL}/api/movies`);
  const { movies } = await res.json();
  await Promise.all(
    movies.map((m) =>
      fetch(`${API_URL}/api/movies/${m.id}/watchlist`, { method: "DELETE" })
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
  await resetWatchlist();
  await gotoHome(page);
  await connectToServer(page);
}

const NAV_ITEMS = ["Films", "Series", "New", "Favorites"];
const SMART_SECTIONS = ["Smart Collections", "Smart Genres"];

// The sidebar is open by default; make sure it is before interacting.
async function openSidebar(page) {
  const toggle = page.locator(".sidebar-toggle");
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  await expect(page.locator(".sidebar.open")).toBeVisible();
}

async function toggleSidebar(page) {
  await page.click(".sidebar-toggle");
}

// Click a top-level sidebar entry (Films / Series / New / Favorites).
async function selectNav(page, label) {
  await openSidebar(page);
  await page.click(`.sidebar .nav-item:has-text("${label}")`);
}

// Click an entry inside an accordion section (a director or genre).
async function selectSub(page, label) {
  await openSidebar(page);
  await page.click(`.sidebar .sidebar-sub:has-text("${label}")`);
}

async function expandSection(page, title) {
  await openSidebar(page);
  const head = page.locator(`.sidebar .accordion-head:has-text("${title}")`);
  const expanded = await head.getAttribute("aria-expanded");
  if (expanded !== "true") await head.click();
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
  NAV_ITEMS,
  SMART_SECTIONS,
  resetFavorites,
  resetWatchlist,
  gotoHome,
  connectToServer,
  openLibrary,
  openSidebar,
  toggleSidebar,
  selectNav,
  selectSub,
  expandSection,
  videoPaused,
};
