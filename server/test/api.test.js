const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createApp } = require("../src/index");

function makeMovieDir(files = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "movienight-test-"));
  for (const [rel, contents] of files) {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, contents);
  }
  return dir;
}

async function withServer(ctx, opts = {}) {
  const movieDir = opts.movieDir || makeMovieDir([["Movie (2021).mp4", VIDEO_BYTES]]);
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "movienight-data-"));
  const app = createApp({ movieDir, dataDir, apiKey: opts.apiKey || "", tmdb: opts.tmdb });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((res) => server.once("listening", res));
  ctx.baseUrl = `http://127.0.0.1:${server.address().port}`;
  ctx.movieDir = movieDir;
  ctx.dataDir = dataDir;
  ctx.movies = (await (await fetch(`${ctx.baseUrl}/api/movies`)).json()).movies;
  ctx.shutdown = () =>
    new Promise((res) => {
      server.closeAllConnections?.();
      server.close(() => res());
    });
}

function afterCtx(t) {
  t.after(async () => {
    await t.shutdown?.();
    t.shutdown = null;
  });
}

const VIDEO_BYTES = Buffer.alloc(64, 0x42);

const fakeTmdb = {
  configured: true,
  fetchInfo: async () => ({
    title: "Asteroid City",
    year: 2023,
    tagline: "You can't wake up if you don't fall asleep.",
    overview: "A playwright and his family visit a tiny desert town.",
    rating: 8.1,
    voteCount: 1234,
    genres: ["Comedy", "Drama"],
    runtime: 104,
    tmdbId: 715931,
    imdbId: "tt14230388",
    posterPath: "/poster.jpg",
    source: "tmdb",
    fetchedAt: "2026-01-01T00:00:00.000Z",
  }),
  downloadPoster: async (_p, dest) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, "fake-jpeg");
    return true;
  },
};

test("status reports folder, count and tmdb configuration", async (t) => {
  await withServer(t, { apiKey: "secret" });
  afterCtx(t);
  const status = await (await fetch(`${t.baseUrl}/api/status`)).json();
  assert.equal(status.ok, true);
  assert.equal(status.tmdbConfigured, true);
});

test("scans nested movie files with sidecar info and poster", async (t) => {
  const movieDir = makeMovieDir([
    ["Sci-Fi/Rushmore.mkv", "dummy"],
    ["Asteroid City (2023).mp4", VIDEO_BYTES],
    ["poster.jpg", "fake-jpeg"],
  ]);
  await withServer(t, { movieDir });
  afterCtx(t);
  assert.equal(t.movies.length, 2);
  const asteroid = t.movies.find((m) => m.title.toLowerCase().includes("asteroid"));
  assert.ok(asteroid, "found asteroid city");
  assert.equal(asteroid.year, 2023);
  assert.equal(asteroid.hasPoster, true);
  assert.ok(asteroid.posterUrl);
  t.close?.();
});

test("meta endpoint requires explicit confirm opt-in", async (t) => {
  await withServer(t, { apiKey: "secret", tmdb: fakeTmdb });
  afterCtx(t);
  const id = t.movies[0].id;

  const noConfirm = await fetch(`${t.baseUrl}/api/movies/${id}/meta`, {
    method: "POST",
    body: "{}",
    headers: { "Content-Type": "application/json" },
  });
  assert.equal(noConfirm.status, 400);
  assert.match((await noConfirm.json()).error, /Opt-in/i);
});

test("meta writes sidecar info.json + poster after user confirmation", async (t) => {
  const movieDir = makeMovieDir([["Asteroid City (2023).mp4", VIDEO_BYTES]]);
  await withServer(t, { movieDir, tmdb: fakeTmdb });
  afterCtx(t);
  const id = t.movies[0].id;
  assert.equal(t.movies[0].hasInfo, false);

  const res = await fetch(`${t.baseUrl}/api/movies/${id}/meta`, {
    method: "POST",
    body: JSON.stringify({ confirm: true }),
    headers: { "Content-Type": "application/json" },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.movie.hasInfo, true);
  assert.equal(body.movie.title, "Asteroid City");
  assert.equal(body.movie.imdbId, "tt14230388");

  const fresh = (await (await fetch(`${t.baseUrl}/api/movies/${id}`)).json()).movie;
  assert.equal(fresh.hasPoster, true);
  assert.ok(fs.existsSync(path.join(movieDir, "info.json")), "info.json written next to movie");
  assert.ok(fs.existsSync(path.join(movieDir, "poster.jpg")), "poster.jpg written next to movie");
});

test("missing key returns clean 502 on meta fetch", async (t) => {
  await withServer(t, { tmdb: { configured: false, fetchInfo: async () => { throw Object.assign(new Error("TMDB API key not configured"), { code: "NO_KEY" }); } } });
  afterCtx(t);
  const id = t.movies[0].id;
  const res = await fetch(`${t.baseUrl}/api/movies/${id}/meta`, {
    method: "POST",
    body: JSON.stringify({ confirm: true }),
    headers: { "Content-Type": "application/json" },
  });
  assert.equal(res.status, 502);
  assert.match((await res.json()).error, /TMDB_API_KEY/i);
});

test("favorites toggle persists", async (t) => {
  await withServer(t, {});
  afterCtx(t);
  const id = t.movies[0].id;

  const set = await (await fetch(`${t.baseUrl}/api/movies/${id}/favorite`, {
    method: "POST",
    body: JSON.stringify({ favorite: true }),
    headers: { "Content-Type": "application/json" },
  })).json();
  assert.equal(set.favorite, true);

  const favs = (await (await fetch(`${t.baseUrl}/api/movies?favorites=1`)).json()).movies;
  assert.equal(favs.length, 1);
  assert.equal(favs[0].id, id);

  await fetch(`${t.baseUrl}/api/movies/${id}/favorite`, {
    method: "POST",
    body: JSON.stringify({ favorite: false }),
    headers: { "Content-Type": "application/json" },
  });
  const empty = (await (await fetch(`${t.baseUrl}/api/movies?favorites=1`)).json()).movies;
  assert.equal(empty.length, 0);
});

test("stream serves full and ranged responses", async (t) => {
  const movieDir = makeMovieDir([["movie.mp4", VIDEO_BYTES]]);
  await withServer(t, { movieDir });
  afterCtx(t);
  const id = t.movies[0].id;

  const full = await fetch(`${t.baseUrl}/api/movies/${id}/stream`);
  assert.equal(full.status, 200);
  assert.match(full.headers.get("content-type"), /video/);
  assert.equal(full.headers.get("accept-ranges"), "bytes");
  assert.equal((await full.arrayBuffer()).byteLength, VIDEO_BYTES.length);

  const range = await fetch(`${t.baseUrl}/api/movies/${id}/stream`, { headers: { Range: "bytes=0-9" } });
  assert.equal(range.status, 206);
  assert.equal(range.headers.get("content-range"), `bytes 0-9/${VIDEO_BYTES.length}`);
  assert.equal((await range.arrayBuffer()).byteLength, 10);

  const bad = await fetch(`${t.baseUrl}/api/movies/${id}/stream`, { headers: { Range: `bytes=${VIDEO_BYTES.length}-` } });
  assert.equal(bad.status, 416);
});
test("kind filter returns only films or only series", async (t) => {
  const movieDir = makeMovieDir([
    ["Films/Asteroid City (2023).mp4", VIDEO_BYTES],
    ["Series/The Weekly Show S01E03.mkv", VIDEO_BYTES],
  ]);
  await withServer(t, { movieDir });
  afterCtx(t);
  assert.equal(t.movies.length, 2);

  const films = (await (await fetch(`${t.baseUrl}/api/movies?kind=film`)).json()).movies;
  assert.equal(films.length, 1);
  assert.match(films[0].title, /Asteroid City/i);
  assert.equal(films[0].kind, "film");

  const series = (await (await fetch(`${t.baseUrl}/api/movies?kind=series`)).json()).movies;
  assert.equal(series.length, 1);
  assert.match(series[0].title, /Weekly Show/i);
  assert.equal(series[0].kind, "series");
  t.close?.();
});

test("movies expose kind + addedAt and sort=added is newest-first", async (t) => {
  const movieDir = makeMovieDir([
    ["Films/Asteroid City (2023).mp4", VIDEO_BYTES],
    ["Films/Rushmore (1998).mp4", VIDEO_BYTES],
  ]);
  await withServer(t, { movieDir });
  afterCtx(tắt);
  assert.equal(t.movies.length, 2);
  for (const m of t.movies) {
    assert.equal(m.kind, "film");
    assert.ok(typeof m.addedAt === "number", "addedAt is a timestamp");
  }

  const added = (await (await fetch(`${t.baseUrl}/api/movies?sort=added`)).json()).movies;
  assert.equal(added.length, 2);
  assert.ok(added[0].addedAt >= added[1].addedAt, "newest file sorts first");
  t.close?.();
});

