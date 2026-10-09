// User-journey suite: walks the end-to-end flow through the product:
//   home screen -> connect -> browse titles -> search -> switch views
//   -> choose a film -> favourite it -> play -> pause -> resume -> exit
//
// Runs against the real app and the real media server (see playwright.config.js).

const { test, expect } = require("@playwright/test");
const {
  API_URL,
  resetFavorites,
  gotoHome,
  connectToServer,
  selectView,
  openMenu,
  videoPaused,
} = require("./helpers");

async function waitForPlayable(video) {
  await video.evaluate((v) => {
    if (v.readyState >= 2) return undefined;
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("video never became ready")), 15000);
      v.addEventListener("canplay", () => {
        clearTimeout(t);
        resolve();
      });
    });
  });
}

test("full journey: home -> browse -> choose film -> play -> pause -> resume", async ({ page }) => {
  await resetFavorites();

  // 1. Home screen -----------------------------------------------------------
  await gotoHome(page);
  await expect(page.locator(".logo-big")).toContainText("localflix");
  await expect(page.locator(".connect-card")).toHaveCount(2);

  // 2. Connect to the media server ------------------------------------------
  await connectToServer(page);
  await expect(page.locator(".topbar")).toBeVisible();

  // 3. Browse titles (default "Films" view: Alpha, Bravo, Delta) ------------
  await expect(page.locator(".grid .card")).toHaveCount(3);
  const filmTitles = await page.locator(".grid .card .card-title").allInnerTexts();
  expect(filmTitles.map((s) => s.trim()).sort()).toEqual(["Alpha", "Bravo", "Delta"]);

  // 4. Search narrows the grid ----------------------------------------------
  await page.fill(".search input", "brav");
  await expect(page.locator(".grid .card")).toHaveCount(1);
  await expect(page.locator(".grid .card .card-title")).toHaveText("Bravo");
  await page.click(".search .clear");
  await expect(page.locator(".grid .card")).toHaveCount(3);

  // 5. Switch views from the hamburger menu ---------------------------------
  await selectView(page, "Series");
  await expect(page.locator(".grid .card")).toHaveCount(2);
  await expect(page.locator(".grid .card .card-title").first()).toContainText("Charlie");

  await selectView(page, "Newly Added");
  await expect(page.locator(".grid .card")).toHaveCount(5); // all titles

  await selectView(page, "Films");
  await expect(page.locator(".grid .card")).toHaveCount(3);

  // 6. Choose a film -> title modal -----------------------------------------
  await page.locator(".grid .card", { hasText: "Bravo" }).first().click();
  await expect(page.locator(".modal-backdrop")).toBeVisible();
  await expect(page.locator(".modal-headline h1")).toHaveText("Bravo");
  await expect(page.locator(".modal .synopsis")).toContainText("safecracker");

  // 7. Favourite it ----------------------------------------------------------
  await page.click(".modal .btn-fav");
  await expect(page.locator(".modal .btn-fav")).toContainText("In Favorites");

  // 8. Play ------------------------------------------------------------------
  await page.click(".modal .btn-play");
  const overlay = page.locator(".player-overlay");
  await expect(overlay).toBeVisible();
  const video = page.locator("video.player-video");
  await expect(video).toBeVisible();
  await expect(video).toHaveAttribute("controls", "");
  expect(await video.getAttribute("src")).toContain("/stream");

  await waitForPlayable(video);
  // autoPlay is enabled, so playback should have started on its own.
  await expect.poll(() => videoPaused(page), { timeout: 10000 }).toBe(false);

  // 9. Pause -----------------------------------------------------------------
  await video.evaluate((v) => v.pause());
  await expect.poll(() => videoPaused(page)).toBe(true);

  // 10. Resume ---------------------------------------------------------------
  await video.evaluate((v) => {
    v.muted = true;
    return v.play();
  });
  await expect.poll(() => videoPaused(page), { timeout: 10000 }).toBe(false);

  // 11. Exit the player (back to the modal) ---------------------------------
  await page.click(".player-close");
  await expect(page.locator(".player-overlay")).toHaveCount(0);
  await expect(page.locator(".modal-backdrop")).toBeVisible();

  // 12. The favourite persisted into the Favorites view ----------------------
  await page.click(".modal-close");
  await expect(page.locator(".modal-backdrop")).toHaveCount(0);
  await selectView(page, "Favorites");
  await expect(page.locator(".grid .card")).toHaveCount(1);
  await expect(page.locator(".grid .card .card-title")).toHaveText("Bravo");
  await expect(page.locator(".grid .card .fav-btn")).toHaveClass(/on/);
});

test("disconnect returns the user to the home screen", async ({ page }) => {
  await resetFavorites();
  await gotoHome(page);
  await connectToServer(page);

  await page.click(".topbar-right .btn-ghost"); // Disconnect
  await expect(page.locator(".connect-screen")).toBeVisible();
  await expect(page.locator(".topbar")).toHaveCount(0);
});

test("the app rejects an unreachable server with an inline error", async ({ page }) => {
  await gotoHome(page);
  await page.fill(".url-input", "http://127.0.0.1:9/");
  await page.click('.connect-panels button[type="submit"]');
  await expect(page.locator(".connect-error")).toBeVisible();
  await expect(page.locator(".topbar")).toHaveCount(0);
});
