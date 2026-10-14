// UI design suite: asserts placement and styling of the app's design
// elements (home screen, top bar, browse grid/cards, title modal, player).
//
// These tests intentionally assert computed CSS and geometry, so a
// regression in layout or theme colours fails the build.

const { test, expect } = require("@playwright/test");
const { gotoHome, openLibrary, openSidebar, expandSection, NAV_ITEMS, SMART_SECTIONS } = require("./helpers");

// ---------------------------------------------------------------------------
// Home / connect screen
// ---------------------------------------------------------------------------
test.describe("Design - home (connect screen)", () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page);
  });

  test("hero is horizontally centred and the wordmark is split two-tone", async ({ page }) => {
    const vp = page.viewportSize();
    const hero = await page.locator(".connect-hero").boundingBox();
    expect(Math.abs(hero.x + hero.width / 2 - vp.width / 2)).toBeLessThanOrEqual(2);

    const logo = page.locator(".logo-big");
    await expect(logo).toContainText("movienight");
    await expect(logo).toHaveCSS("font-size", "56px");
    await expect(logo).toHaveCSS("color", "rgb(46, 125, 50)"); // --accent (deep forest green)
    await expect(logo.locator("span")).toHaveCSS("color", "rgb(255, 255, 255)");
  });

  test("the two connect cards sit side by side", async ({ page }) => {
    const cards = page.locator(".connect-card");
    await expect(cards).toHaveCount(2);

    const a = await cards.nth(0).boundingBox();
    const b = await cards.nth(1).boundingBox();
    expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(2); // same row
    expect(b.x).toBeGreaterThan(a.x + a.width - 1); // B is to the right of A

    await expect(cards.nth(0)).toContainText("local folder");
    await expect(cards.nth(1)).toContainText("Connect to a server");
  });

  test("primary buttons use the forest-green accent and rounded corners", async ({ page }) => {
    const btn = page.locator(".connect-card .btn-primary").first();
    await expect(btn).toHaveCSS("background-color", "rgb(46, 125, 50)");
    await expect(btn).toHaveCSS("border-radius", "10px");
  });

  test("the server field is pre-filled with the dummy test port 1234", async ({ page }) => {
    const field = page.locator(".url-input");
    await expect(field).toHaveValue("http://127.0.0.1:1234");
    await expect(page.locator('.connect-card:has-text("Connect to a server") button[type="submit"]')).toBeEnabled();
  });
});

// ---------------------------------------------------------------------------
// Top bar shell + left accordion sidebar
// ---------------------------------------------------------------------------
test.describe("Design - top bar", () => {
  test.beforeEach(async ({ page }) => {
    await openLibrary(page);
  });

  test("is a sticky bar: brand left, search middle, disconnect right", async ({ page }) => {
    const bar = page.locator(".topbar");
    await expect(bar).toHaveCSS("position", "sticky");
    expect((await bar.boundingBox()).y).toBeLessThanOrEqual(1);

    const brand = await page.locator(".brand-block").boundingBox();
    const search = await page.locator(".search").boundingBox();
    const right = await page.locator(".topbar-right").boundingBox();
    expect(brand.x).toBeLessThan(search.x);
    expect(search.x).toBeLessThan(right.x);

    await expect(page.locator(".topbar-right .btn-ghost")).toHaveText("Disconnect");
  });

  test("sidebar toggle sits left of the logo and slides the accordion open/closed", async ({ page }) => {
    const toggle = page.locator(".sidebar-toggle");
    const toggleBox = await toggle.boundingBox();
    const logo = await page.locator(".logo").boundingBox();
    expect(toggleBox.x).toBeLessThan(logo.x);

    const sidebar = page.locator(".sidebar");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(sidebar).toHaveClass(/open/);
    const openWidth = (await sidebar.boundingBox()).width;
    expect(openWidth).toBeGreaterThanOrEqual(240);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(sidebar).not.toHaveClass(/open/);
    await expect.poll(async () => (await sidebar.boundingBox()).width).toBeLessThan(openWidth);
  });

  test("sidebar lists the nav items and the two smart accordion sections", async ({ page }) => {
    await openSidebar(page);
    for (const label of NAV_ITEMS) {
      await expect(page.locator(`.sidebar .nav-item:has-text("${label}")`)).toBeVisible();
    }
    for (const label of SMART_SECTIONS) {
      await expect(page.locator(`.sidebar .accordion-head:has-text("${label}")`)).toBeVisible();
    }

    // The default view (Films) is accented in forest green.
    const films = page.locator('.sidebar .nav-item:has-text("Films")');
    await expect(films).toHaveClass(/active/);
    await expect(films).toHaveCSS("color", "rgb(56, 160, 62)"); // --accent-hover
  });

  test("Smart Genres accordion expands to the library's six most common genres", async ({ page }) => {
    await openSidebar(page);
    // Bravo carries [Thriller, Crime]; those become the two most common genres.
    await expandSection(page, "Smart Genres");
    const subs = page.locator(".sidebar .accordion:has(.accordion-head:has-text('Smart Genres')) .sidebar-sub");
    await expect(subs.first()).toBeVisible();
    const labels = await subs.allInnerTexts();
    expect(labels.join(" ")).toContain("Thriller");
    expect(labels.join(" ")).toContain("Crime");
  });
});

// ---------------------------------------------------------------------------
// Browse grid + cards
// ---------------------------------------------------------------------------
test.describe("Design - browse grid & cards", () => {
  test.beforeEach(async ({ page }) => {
    await openLibrary(page);
  });

  test("cards flow in a grid with 2:3 poster artwork", async ({ page }) => {
    await expect(page.locator(".grid")).toHaveCSS("display", "grid");
    await expect(page.locator(".grid .card")).toHaveCount(3); // 3 films, series excluded

    const c0 = await page.locator(".grid .card").nth(0).boundingBox();
    const c1 = await page.locator(".grid .card").nth(1).boundingBox();
    expect(Math.abs(c0.y - c1.y)).toBeLessThanOrEqual(2); // same row
    expect(c1.x).toBeGreaterThan(c0.x);

    const poster = await page.locator(".grid .card .poster").first().boundingBox();
    expect(poster.width / poster.height).toBeCloseTo(2 / 3, 1);
  });

  test("title/meta styling, rating star, and the 'No info' chip", async ({ page }) => {
    const alpha = page.locator(".grid .card", { hasText: "Alpha" }).first();
    await expect(alpha.locator(".card-title")).toHaveCSS("font-weight", "600");
    await expect(alpha.locator(".no-info-chip")).toHaveText("No info");
    expect(alpha).toHaveClass(/card-unmet/);

    const bravo = page.locator(".grid .card", { hasText: "Bravo" }).first();
    await expect(bravo.locator(".star")).toContainText("★ 8.1");
    await expect(bravo.locator(".no-info-chip")).toHaveCount(0);
  });

  test("favourite button is hidden until hover, pinned top-right, circular", async ({ page }) => {
    const card = page.locator(".grid .card").first();
    const fav = card.locator(".fav-btn");

    await expect(fav).toHaveCSS("opacity", "0");
    await card.hover();
    await expect(fav).toHaveCSS("opacity", "1");

    const c = await card.boundingBox();
    const f = await fav.boundingBox();
    expect(f.x + f.width).toBeLessThanOrEqual(c.x + c.width + 0.5); // within right edge
    expect(f.x).toBeGreaterThan(c.x + c.width / 2); // right half
    expect(f.y).toBeLessThan(c.y + c.height / 2); // top half
    await expect(fav).toHaveCSS("border-radius", "50%");
  });

  test("hover reveals a centred play overlay", async ({ page }) => {
    const card = page.locator(".grid .card").first();
    const overlay = card.locator(".card-hover-play");
    await expect(overlay).toHaveCSS("opacity", "0");
    await card.hover();
    await expect(overlay).toHaveCSS("opacity", "1");
    await expect(overlay).toContainText("Play");
  });
});

// ---------------------------------------------------------------------------
// Title modal
// ---------------------------------------------------------------------------
test.describe("Design - title modal", () => {
  test.beforeEach(async ({ page }) => {
    await openLibrary(page);
  });

  test("opens a centred modal over a full-screen backdrop", async ({ page }) => {
    const vp = page.viewportSize();
    await page.locator(".grid .card", { hasText: "Bravo" }).first().click();

    const backdrop = page.locator(".modal-backdrop");
    await expect(backdrop).toBeVisible();
    await expect(backdrop).toHaveCSS("position", "fixed");
    const bd = await backdrop.boundingBox();
    expect(bd.width).toBeGreaterThanOrEqual(vp.width - 1);
    expect(bd.height).toBeGreaterThanOrEqual(vp.height - 1);

    const modal = await page.locator(".modal").boundingBox();
    expect(Math.abs(modal.x + modal.width / 2 - vp.width / 2)).toBeLessThanOrEqual(2);

    // The info card is flipped: poster on the RIGHT, headline/info on the LEFT.
    const poster = await page.locator(".modal-poster").boundingBox();
    const headline = await page.locator(".modal-headline").boundingBox();
    const mid = modal.x + modal.width / 2;
    expect(poster.x).toBeGreaterThan(mid); // artwork in the right half
    expect(headline.x).toBeLessThan(mid); // info in the left half

    await expect(page.locator(".modal-headline h1")).toHaveText("Bravo");
    await expect(page.locator(".modal .actions")).toHaveCSS("display", "flex");
    await expect(page.locator(".modal .btn-play")).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(page.locator(".modal .btn-fav")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------
test.describe("Design - player", () => {
  test.beforeEach(async ({ page }) => {
    await openLibrary(page);
  });

  test("is a full-screen black stage with a titled top bar", async ({ page }) => {
    const vp = page.viewportSize();
    await page.locator(".grid .card", { hasText: "Bravo" }).first().click();
    await page.click(".modal .btn-play");

    const overlay = page.locator(".player-overlay");
    await expect(overlay).toBeVisible();
    await expect(overlay).toHaveCSS("position", "fixed");
    await expect(overlay).toHaveCSS("background-color", "rgb(0, 0, 0)");
    const ob = await overlay.boundingBox();
    expect(ob.width).toBeGreaterThanOrEqual(vp.width - 1);
    expect(ob.height).toBeGreaterThanOrEqual(vp.height - 1);

    await expect(page.locator(".player-title")).toHaveText("Bravo");
    const video = page.locator("video.player-video");
    await expect(video).toBeVisible();
    await expect(video).toHaveAttribute("controls", "");
    const vb = await video.boundingBox();
    expect(vb.width).toBeLessThanOrEqual(vp.width + 1);
  });
});
