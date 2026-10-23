// UI design suite: asserts placement and styling of the app's design
// elements (home screen, top bar, browse grid/cards, title modal, player).
//
// These tests intentionally assert computed CSS and geometry, so a
// regression in layout or theme colours fails the build.

const { test, expect } = require("@playwright/test");
const {
  gotoHome,
  openLibrary,
  openSidebar,
  selectNav,
  toggleSidebar,
  expandSection,
  NAV_ITEMS,
  SMART_SECTIONS,
} = require("./helpers");

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

  test("is a sticky bar with the logo centred, search right, and a user menu", async ({ page }) => {
    const bar = page.locator(".topbar");
    await expect(bar).toHaveCSS("position", "sticky");
    expect((await bar.boundingBox()).y).toBeLessThanOrEqual(1);

    const logo = await page.locator(".topbar .logo").boundingBox();
    const search = await page.locator(".search").boundingBox();
    const user = await page.locator(".user-avatar").boundingBox();
    const barBox = await bar.boundingBox();

    // Logo is approximately centred horizontally.
    expect(Math.abs(logo.x + logo.width / 2 - (barBox.x + barBox.width / 2))).toBeLessThanOrEqual(4);

    // Search sits to the right of the logo and immediately left of the user menu.
    expect(search.x).toBeGreaterThanOrEqual(logo.x + logo.width - 0.5);
    expect(search.x + search.width).toBeLessThanOrEqual(user.x + 0.5);

    // User avatar sits on the right.
    expect(user.x + user.width).toBeLessThanOrEqual(barBox.x + barBox.width + 0.5);

    // Clicking the user avatar opens a Letterboxd-style flyout with a Disconnect option.
    await page.click(".user-avatar");
    await expect(page.locator(".user-dropdown")).toBeVisible();
    await expect(page.locator(".user-dropdown-item", { hasText: "Disconnect from server" })).toBeVisible();
  });

  test("floating toggle is vertically centred, hidden bars/chevron swap, and it slides the accordion", async ({ page }) => {
    const vp = page.viewportSize();
    const toggle = page.locator(".sidebar-toggle");
    const sidebar = page.locator(".sidebar");

    // Closed by default: hamburger, pinned to the left screen edge, vertically centred.
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(sidebar).not.toHaveClass(/open/);
    await expect(toggle.locator(".bar")).toHaveCount(3);
    await expect(toggle.locator(".chev")).toHaveCount(0);
    const closedBox = await toggle.boundingBox();
    expect(closedBox.x).toBeLessThanOrEqual(1);
    expect(Math.abs(closedBox.y + closedBox.height / 2 - vp.height / 2)).toBeLessThanOrEqual(2);

    const closedWidth = (await sidebar.boundingBox()).width;

    // Open: the icon travels to the right edge of the menu and becomes a chevron.
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(sidebar).toHaveClass(/open/);
    await expect(toggle.locator(".chev")).toHaveCount(1);
    await expect(toggle.locator(".bar")).toHaveCount(0);
    const openWidth = (await sidebar.boundingBox()).width;
    expect(openWidth).toBeGreaterThanOrEqual(240);
    await expect.poll(async () => (await toggle.boundingBox()).x).toBeGreaterThanOrEqual(openWidth - 2);

    // The menu is dimmed-scrim aware: clicking outside closes it.
    await page.locator(".scrim").click({ position: { x: vp.width - 20, y: vp.height - 20 } });
    await expect(sidebar).not.toHaveClass(/open/);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect.poll(async () => (await sidebar.boundingBox()).width).toBeLessThan(openWidth);
    expect(closedWidth).toBeLessThan(2);
  });

  test("sidebar lists the nav items and the two smart accordion sections", async ({ page }) => {
    await openSidebar(page);
    for (const label of NAV_ITEMS) {
      await expect(page.locator(`.sidebar .nav-item:has-text("${label}")`)).toBeVisible();
    }
    for (const label of SMART_SECTIONS) {
      await expect(page.locator(`.sidebar .accordion-head:has-text("${label}")`)).toBeVisible();
    }

    // The default view (All) is accented in forest green.
    const all = page.locator('.sidebar .nav-item:has-text("All")');
    await expect(all).toHaveClass(/active/);
    await expect(all).toHaveCSS("color", "rgb(56, 160, 62)"); // --accent-hover
    const films = page.locator('.sidebar .nav-item:has-text("Films")');
    await expect(films).not.toHaveClass(/active/);
  });

  test("Smart Genres accordion expands to the library's six most common genres", async ({ page }) => {
    await openSidebar(page);
    await expandSection(page, "Smart Genres");
    const subs = page.locator(".sidebar .accordion:has(.accordion-head:has-text('Smart Genres')) .sidebar-sub");
    await expect(subs.first()).toBeVisible();
    const labels = await subs.allInnerTexts();
    expect(labels.join(" ")).toContain("Animation");
    expect(labels.join(" ")).toContain("Comedy");
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
    await expect(page.locator(".grid .card")).toHaveCount(25); // all titles (24 films + 1 series)

    const c0 = await page.locator(".grid .card").nth(0).boundingBox();
    const c1 = await page.locator(".grid .card").nth(1).boundingBox();
    expect(Math.abs(c0.y - c1.y)).toBeLessThanOrEqual(2); // same row
    expect(c1.x).toBeGreaterThan(c0.x);

    const poster = await page.locator(".grid .card .poster").first().boundingBox();
    expect(poster.width / poster.height).toBeCloseTo(2 / 3, 1);
  });

  test("title/meta styling, rating star, and all real films have info", async ({ page }) => {
    const spir = page.locator(".grid .card", { hasText: "Spirited Away" }).first();
    await expect(spir.locator(".card-title")).toHaveCSS("font-weight", "600");
    await expect(spir.locator(".no-info-chip")).toHaveCount(0);
    await expect(spir.locator(".star")).toContainText("★ 8.5");
  });

  test("favourite & watchlist buttons are hidden until hover, pinned top-right, circular", async ({ page }) => {
    const card = page.locator(".grid .card").first();
    const fav = card.locator(".fav-btn");
    const watch = card.locator(".watch-btn");

    await expect(fav).toHaveCSS("opacity", "0");
    await expect(watch).toHaveCSS("opacity", "0");
    await card.hover();
    await expect(fav).toHaveCSS("opacity", "1");
    await expect(watch).toHaveCSS("opacity", "1");

    const c = await card.boundingBox();
    const f = await fav.boundingBox();
    const w = await watch.boundingBox();
    expect(f.x + f.width).toBeLessThanOrEqual(c.x + c.width + 0.5); // within right edge
    expect(f.x).toBeGreaterThan(c.x + c.width / 2); // right half
    expect(f.y).toBeLessThan(c.y + c.height / 2); // top half
    expect(w.x + w.width).toBeLessThanOrEqual(f.x + 0.5); // watchlist sits left of favourite
    await expect(fav).toHaveCSS("border-radius", "50%");
    await expect(watch).toHaveCSS("border-radius", "50%");
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
    await page.locator(".grid .card", { hasText: "Spirited Away" }).first().click();

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

    await expect(page.locator(".modal-headline h1")).toHaveText("Spirited Away");
    await expect(page.locator(".modal .actions")).toHaveCSS("display", "flex");
    await expect(page.locator(".modal .btn-play")).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(page.locator(".modal .btn-fav")).toBeVisible();
    await expect(page.locator(".modal .btn-watch")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Series + episodes
// ---------------------------------------------------------------------------
test.describe("Design - series & episodes", () => {
  test.beforeEach(async ({ page }) => {
    await openLibrary(page);
  });

  test("a series is one card tagged 'Series' with an episode count", async ({ page }) => {
    await selectNav(page, "Series");
    await toggleSidebar(page);

    const card = page.locator(".grid .card", { hasText: "Adventure Time" });
    await expect(card).toHaveCount(1);
    await expect(card.locator(".series-chip")).toHaveText("Series");
    await expect(card.locator(".ep-count")).toHaveText("6 ep");
  });

  test("episode browser is a full-screen, season-grouped list with a centred column", async ({ page }) => {
    const vp = page.viewportSize();
    await selectNav(page, "New");
    await toggleSidebar(page);
    await page.locator(".grid .card", { hasText: "Adventure Time" }).first().click();
    await page.locator(".modal .episodes-section button", { hasText: "View all episodes" }).click();

    const view = page.locator(".episodes-view");
    await expect(view).toBeVisible();
    await expect(view).toHaveCSS("position", "fixed");
    const box = await view.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(vp.width - 1);
    expect(box.height).toBeGreaterThanOrEqual(vp.height - 1);

    await expect(view.locator(".ep-season-title")).toHaveCount(2);
    await expect(view.locator(".ep-season-title").first()).toHaveText("Season 1");
    await expect(view.locator(".ep-row")).toHaveCount(6);

    const body = await view.locator(".episodes-body").boundingBox();
    expect(body.width).toBeLessThanOrEqual(921); // min(920px, 100%)
    expect(Math.abs(body.x + body.width / 2 - vp.width / 2)).toBeLessThanOrEqual(2);

    // Header back control on the left, close control on the right.
    const back = await view.locator(".episodes-top .btn-ghost").boundingBox();
    const close = await view.locator(".episodes-top .player-close").boundingBox();
    expect(back.x).toBeLessThan(vp.width / 2);
    expect(close.x).toBeGreaterThan(vp.width / 2);
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
    await page.locator(".grid .card", { hasText: "Spirited Away" }).first().click();
    await page.click(".modal .btn-play");

    const overlay = page.locator(".player-overlay");
    await expect(overlay).toBeVisible();
    await expect(overlay).toHaveCSS("position", "fixed");
    await expect(overlay).toHaveCSS("background-color", "rgb(0, 0, 0)");
    const ob = await overlay.boundingBox();
    expect(ob.width).toBeGreaterThanOrEqual(vp.width - 1);
    expect(ob.height).toBeGreaterThanOrEqual(vp.height - 1);

    await expect(page.locator(".player-title")).toHaveText("Spirited Away");
    const video = page.locator("video.player-video");
    await expect(video).toBeVisible();
    await expect(video).toHaveAttribute("controls", "");
    const vb = await video.boundingBox();
    expect(vb.width).toBeLessThanOrEqual(vp.width + 1);
  });
});

// ---------------------------------------------------------------------------
// Library sort filter + people search
// ---------------------------------------------------------------------------
test.describe("Design - library filter", () => {
  test.beforeEach(async ({ page }) => {
    await openLibrary(page);
    // The grid must be unobstructed: make sure the nav scrim is not shown.
    if ((await page.locator(".sidebar-toggle").getAttribute("aria-expanded")) === "true") {
      await toggleSidebar(page);
    }
    await expect(page.locator(".scrim")).not.toHaveClass(/show/);
  });

  const titles = (page) => page.locator(".grid .card-title").allTextContents();

  test("filter shares the header row with the title and defaults to highest ranking", async ({ page }) => {
    const header = page.locator(".library-header");
    const title = page.locator(".library-header .row-title");
    const bar = page.locator(".library-header .filter-bar");
    await expect(header).toBeVisible();
    await expect(title).toContainText("All"); // default view
    await expect(bar).toBeVisible();

    // Same horizontal band as the title, right-aligned within the content column.
    const titleBox = await title.boundingBox();
    const barBox = await bar.boundingBox();
    expect(Math.abs(titleBox.y + titleBox.height / 2 - (barBox.y + barBox.height / 2))).toBeLessThanOrEqual(6);
    const contentBox = await page.locator(".content").boundingBox();
    const contentPadRight = 28; // .content { padding: 28px ... }
    expect(contentBox.x + contentBox.width - contentPadRight - (barBox.x + barBox.width)).toBeLessThanOrEqual(4);

    const select = page.locator("#sort-select");
    await expect(select).toHaveValue("ranking");
    await expect(select.locator("option")).toHaveText([
      "Highest ranking",
      "Release date",
      "Duration",
      "Alphabetical",
    ]);

    // The direction caret starts neutral (↕).
    await expect(page.locator(".sort-dir")).toHaveText("↕");

    // Default order: rating desc (Spirited Away tops the demo library).
    expect((await titles(page))[0]).toBe("Spirited Away");
  });

  test("the direction caret toggles descending then ascending", async ({ page }) => {
    const dir = page.locator(".sort-dir");
    await expect(dir).toHaveText("↕");

    const natural = await titles(page);
    expect(natural[0]).toBe("Spirited Away");

    // First click: descending (▼). Ranking is already desc, so no reordering.
    await dir.click();
    await expect(dir).toHaveText("▼");
    expect(await titles(page)).toEqual(natural);

    // Second click: ascending (▲). Lowest-rated sinks, unrated stays last.
    await dir.click();
    await expect(dir).toHaveText("▲");
    const asc = await titles(page);
    expect(asc).not.toEqual(natural);
    expect(asc[asc.length - 1]).toBe("Spirited Away"); // top-rated last when flipped
    expect(asc.filter((t) => t === "Adventure Time")).toHaveLength(1);

    // Third click: back to descending.
    await dir.click();
    await expect(dir).toHaveText("▼");
    expect(await titles(page)).toEqual(natural);
  });

  test("picking a different sort reorders the grid", async ({ page }) => {
    const before = await titles(page);
    expect(before[0]).toBe("Spirited Away");

    await page.selectOption("#sort-select", "alphabetical");
    const alpha = await titles(page);
    expect(alpha[0]).toBe("Adventure Time"); // "All" view includes the series
    expect([...alpha].sort()).toEqual(alpha);
    expect(alpha).not.toEqual(before);

    await page.selectOption("#sort-select", "release");
    const release = await titles(page);
    expect(release[0]).toBe("The Phoenician Scheme"); // newest demo film (2025)

    await page.selectOption("#sort-select", "duration");
    const duration = await titles(page);
    expect(duration[0]).toBe("Princess Mononoke"); // 134 min, longest

    // Back to the default.
    await page.selectOption("#sort-select", "ranking");
    expect(await titles(page)).toEqual(before);
  });

  test("the header icon cycles films, series and all", async ({ page }) => {
    const icon = page.locator(".library-header .kind-icon");
    await expect(icon).toHaveText("🎞️"); // "All" is the default
    expect(await titles(page)).toHaveLength(25); // 24 films + 1 series

    await icon.click();
    await expect(icon).toHaveText("🎬"); // films
    expect(await titles(page)).toHaveLength(24);

    await icon.click();
    await expect(icon).toHaveText("📺"); // series
    expect(await titles(page)).toHaveLength(1);
    expect((await titles(page))[0]).toBe("Adventure Time");

    await icon.click();
    await expect(icon).toHaveText("🎞️"); // back to all
    expect(await titles(page)).toHaveLength(25);
  });

  test("search matches top billed actors and directors, not just titles", async ({ page }) => {
    const search = page.locator(".topbar .search input");

    await search.fill("Hayao Miyazaki");
    const byDirector = await titles(page);
    expect(byDirector).toHaveLength(12);
    expect(byDirector).toContain("Spirited Away");
    expect(byDirector).not.toContain("Asteroid City");

    await search.fill("Bill Murray");
    const byActor = await titles(page);
    expect(byActor).toHaveLength(9);
    expect(byActor).toContain("The Grand Budapest Hotel");

    await search.fill("");
    expect(await titles(page)).toHaveLength(25);
  });

  test("clicking a person chip in the modal runs that search", async ({ page }) => {
    await page.locator(".grid .card", { hasText: "Spirited Away" }).first().click();
    const modal = page.locator(".modal");
    await expect(modal).toBeVisible();

    // Directors + top billed cast render as clickable chips.
    await expect(modal.locator(".person-chip", { hasText: "Hayao Miyazaki" })).toBeVisible();
    await expect(modal.locator(".person-chip", { hasText: "Rumi Hiiragi" })).toBeVisible();

    await modal.locator(".person-chip", { hasText: "Hayao Miyazaki" }).click();
    await expect(modal).toBeHidden();
    await expect(page.locator(".topbar .search input")).toHaveValue("Hayao Miyazaki");

    const found = await titles(page);
    expect(found).toHaveLength(12);
    expect(found).toContain("Spirited Away");
  });
});
