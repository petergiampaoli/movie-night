// Builds the committed demo library by querying TheMovieDB ONCE per film and
// baking the results onto disk, so the demo server never needs the network (and
// clicking "Get movie information" is instant, because info.json/poster.jpg
// already exist next to every file).
//
//   npm run demo:data
//
// Requires a TMDB v3 API key. Provide it via either:
//   - env var  TMDB_API_KEY
//   - a gitignored file at the repo root:  .tmdb_api_key
//
// Output layout (app/demo-data/movies), one folder per film:
//   <Title (Year)>/<Title (Year)>.webm   small playable clip (canvas + MediaRecorder)
//   <Title (Year)>/poster.jpg            TMDB poster (w342)
//   <Title (Year)>/info.json             TMDB metadata (title, overview, genres, directors, ...)

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FILMS, safeName } from "./demo-films.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(here, "..");
const repoRoot = path.join(appRoot, "..");
const outRoot = path.join(appRoot, "demo-data", "movies");

const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w342";

const CLIP_COLORS = ["#1b4332", "#2d6a4f", "#40916c", "#1e3a5f", "#5f3a1e", "#3a1e5f"];

function readKey() {
  if (process.env.TMDB_API_KEY && process.env.TMDB_API_KEY.trim()) return process.env.TMDB_API_KEY.trim();
  for (const p of [path.join(repoRoot, ".tmdb_api_key"), path.join(appRoot, ".tmdb_api_key")]) {
    if (fs.existsSync(p)) {
      const k = fs.readFileSync(p, "utf8").trim();
      if (k) return k;
    }
  }
  return "";
}

async function tmdb(pathname, params, key) {
  const q = new URLSearchParams({ api_key: key, language: "en-US", ...params });
  const res = await fetch(`${TMDB_API}${pathname}?${q.toString()}`);
  if (!res.ok) throw new Error(`TMDB ${pathname} -> HTTP ${res.status}`);
  const data = await res.json();
  if (data.success === false) throw new Error(data.status_message || `TMDB ${pathname} failed`);
  return data;
}

async function resolveId(film, key) {
  const data = await tmdb("/search/movie", { query: film.title, year: String(film.year), include_adult: "false" }, key);
  const results = data.results || [];
  if (!results.length) return null;
  const exact = results.find(
    (r) => (r.release_date || "").startsWith(String(film.year)) && r.title.toLowerCase() === film.title.toLowerCase()
  );
  const sameYear = results.find((r) => (r.release_date || "").startsWith(String(film.year)));
  return (exact || sameYear || results[0]).id;
}

async function recordClip(page, color, label) {
  const bytes = await page.evaluate(
    async ({ color, label }) => {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext("2d");
      const stream = canvas.captureStream(15);
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp8") ? "video/webm;codecs=vp8" : "video/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      const chunks = [];
      rec.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
      const stopped = new Promise((resolve) => (rec.onstop = resolve));
      rec.start();
      const start = performance.now();
      await new Promise((resolve) => {
        function frame() {
          const t = performance.now() - start;
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, 320, 240);
          ctx.fillStyle = "rgba(255,255,255,0.95)";
          ctx.font = "bold 22px sans-serif";
          ctx.fillText(label, 16, 120);
          if (t < 1000) requestAnimationFrame(frame);
          else resolve();
        }
        requestAnimationFrame(frame);
      });
      rec.stop();
      await stopped;
      const blob = new Blob(chunks, { type: "video/webm" });
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    },
    { color, label }
  );
  return Buffer.from(bytes);
}

async function downloadPoster(posterPath, dest) {
  const res = await fetch(`${TMDB_IMG}${posterPath}`, { redirect: "follow" });
  if (!res.ok) throw new Error(`poster download -> HTTP ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function main() {
  const key = readKey();
  if (!key) {
    console.error(
      "\nNo TMDB API key found.\n\n" +
        "Create a gitignored file with your v3 key first:\n" +
        `  printf '%s' 'YOUR_32_CHAR_V3_KEY' > ${path.join(repoRoot, ".tmdb_api_key")}\n` +
        "then re-run:  npm run demo:data\n"
    );
    process.exit(2);
  }

  fs.rmSync(outRoot, { recursive: true, force: true });
  fs.mkdirSync(outRoot, { recursive: true });

  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage();
  await page.setContent("<!doctype html><html><body></body></html>");

  const failures = [];
  let n = 0;
  for (const film of FILMS) {
    n += 1;
    const label = `${film.title} (${film.year})`;
    try {
      const id = await resolveId(film, key);
      if (!id) throw new Error("no TMDB match");
      const d = await tmdb(`/movie/${id}`, { append_to_response: "credits" }, key);

      const dir = path.join(outRoot, safeName(film));
      fs.mkdirSync(dir, { recursive: true });

      const directors = ((d.credits && d.credits.crew) || []).filter((c) => c.job === "Director").map((c) => c.name);
      const info = {
        title: d.title || film.title,
        year: Number((d.release_date || "").slice(0, 4)) || film.year,
        tagline: d.tagline || null,
        overview: d.overview || null,
        rating: typeof d.vote_average === "number" ? d.vote_average : null,
        voteCount: typeof d.vote_count === "number" ? d.vote_count : null,
        genres: (d.genres || []).map((g) => g.name),
        runtime: typeof d.runtime === "number" ? d.runtime : null,
        directors,
        studios: (d.production_companies || []).map((c) => c.name),
        tmdbId: d.id || null,
        imdbId: d.imdb_id || null,
        source: "tmdb",
        fetchedAt: new Date().toISOString(),
      };

      let posterBytes = 0;
      if (d.poster_path) {
        const posterDest = path.join(dir, "poster.jpg");
        await downloadPoster(d.poster_path, posterDest);
        posterBytes = fs.statSync(posterDest).size;
      }

      const webm = await recordClip(page, CLIP_COLORS[n % CLIP_COLORS.length], label);
      fs.writeFileSync(path.join(dir, `${safeName(film)}.webm`), webm);

      fs.writeFileSync(path.join(dir, "info.json"), JSON.stringify(info, null, 2));
      console.log(
        `  ok  ${label}  (tmdb ${info.tmdbId}, rating ${info.rating}, genres ${info.genres.length}, ` +
          `directors ${directors.join("/") || "?"}, poster ${posterBytes}B, clip ${webm.length}B)`
      );
    } catch (err) {
      failures.push(`${label}: ${err.message}`);
      console.error(`  FAIL ${label}: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 60)); // be polite to the API
  }

  await browser.close();

  console.log(`\nDemo data written to ${outRoot}`);
  if (failures.length) {
    console.error(`\n${failures.length} film(s) failed:\n  - ${failures.join("\n  - ")}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
