// UI design suite: asserts placement and styling of the app's design
// elements (home screen, top bar, browse grid/cards, title modal, player).
//
// These tests intentionally assert computed CSS and geometry, so a
// regression in layout or theme colours fails the build.

const { test, expect } = require("@playwright/test");
const { gotoHome, openLibrary, openMenu, VIEW_LABELS } = require("./helpers");

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
    await expect(logo).toContainText("localflix");
    await expect(logo).toHaveCSS("font-size", "56px");
    await expect(logo).toHaveCSS("color", "rgb(229, 9, 20)"); // --accent
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

  test("primary buttons use the red accent and rounded corners", async ({ page }) => {
    const btn = page.locator(".connect-card .btn-primary").first();
    await expect(btn).toHaveCSS("background-color", "rgb(229, 9, 20)");
    await expect(btn).toHaveCSS("border-radius", "10px");
  });
});

// ---------------------------------------------------------------------------
// Top bar shell + hamburger menu
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

  test("hamburger precedes the logo and drops a panel directly below itself", async ({ page }) => {
    const ham = page.locator(".hamburger");
    const hamBox = await ham.boundingBox();
    const logo = await page.locator(".logo").boundingBox();
    expect(hamBox.x).toBeLessThan(logo.x);

    await expect(ham).toHaveAttribute("aria-expanded", "false");
    await ham.click();
    await expect(ham).toHaveAttribute("aria-expanded", "true");

    const menu = page.locator(".hamburger-menu");
    await expect(menu).toBeVisible();
    const menuBox = await menu.boundingBox();
    expect(menuBox.y).toBeGreaterThanOrEqual(hamBox.y + hamBox.height); // below
    expect(Math.abs(menuBox.x - hamBox.x)).toBeLessThanOrEqual(2); // left-aligned
    expect(menuBox.width).toBeGreaterThanOrEqual(230); // min-width
  });

  test("menu lists the four views in order with icons; active item is accented", async ({ page }) => {
    await openMenu(page);
    const items = page.locator(".menu-item");
    await expect(items).toHaveCount(4);

    for (let i = 0; i < VIEW_LABELS.length; i += 1) {
      await expect(items.nth(i)).toContainText(VIEW_LABELS[i]);
      await expect(items.nth(i).locator(".menu-icon")).toBeVisible();
    }

    // Default view is "Films", so the first item is the active one.
    await expect(items.nth(0)).toHaveClass(/active/);
    await expect(items.nth(0)).toHaveCSS("color", "rgb(229, 9, 20)");
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
