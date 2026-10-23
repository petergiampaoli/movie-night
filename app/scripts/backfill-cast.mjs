// One-off helper: adds `cast` (top billed, TMDB credits order) to the already
// committed demo info.json files, without re-recording the demo clips.
//
//   node scripts/backfill-cast.mjs
//
// Needs a TMDB v3 key (.tmdb_api_key at the repo root, or TMDB_API_KEY env).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, "..", "..");
const moviesRoot = path.join(here, "..", "demo-data", "movies");

function readKey() {
  if (process.env.TMDB_API_KEY && process.env.TMDB_API_KEY.trim()) return process.env.TMDB_API_KEY.trim();
  const p = path.join(repoRoot, ".tmdb_api_key");
  if (fs.existsSync(p)) {
    const k = fs.readFileSync(p, "utf8").trim();
    if (k) return k;
  }
  return "";
}

async function tmdb(pathname, key) {
  const q = new URLSearchParams({ api_key: key, language: "en-US" });
  const url = `https://api.themoviedb.org/3${pathname}${pathname.includes("?") ? "&" : "?"}${q.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function topCast(d) {
  return ((d.credits && d.credits.cast) || [])
    .filter((c) => c && c.name)
    .slice(0, 12)
    .map((c) => ({
      name: c.name,
      character: c.character || null,
      order: typeof c.order === "number" ? c.order : null,
    }));
}

const key = readKey();
if (!key) {
  console.error("No TMDB API key found (.tmdb_api_key or TMDB_API_KEY).");
  process.exit(2);
}

let done = 0;
let skipped = 0;
let failed = 0;

for (const folder of fs.readdirSync(moviesRoot)) {
  const infoPath = path.join(moviesRoot, folder, "info.json");
  if (!fs.existsSync(infoPath)) continue;
  const info = JSON.parse(fs.readFileSync(infoPath, "utf8"));
  if (Array.isArray(info.cast) && info.cast.length) {
    skipped += 1;
    continue;
  }
  if (!info.tmdbId) {
    console.log(`  skip ${folder} (no tmdbId)`);
    skipped += 1;
    continue;
  }
  try {
    const base = info.kind === "series" ? "/tv" : "/movie";
    const d = await tmdb(`${base}/${info.tmdbId}?append_to_response=credits`, key);
    info.cast = topCast(d);
    fs.writeFileSync(infoPath, JSON.stringify(info, null, 2));
    done += 1;
    console.log(`  ok   ${folder} (${info.cast.length} cast)`);
  } catch (err) {
    failed += 1;
    console.log(`  fail ${folder}: ${err.message}`);
  }
}

console.log(`\nbackfilled ${done}, skipped ${skipped}, failed ${failed}`);
process.exit(failed ? 1 : 0);
