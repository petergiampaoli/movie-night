// Development seed data (branch: dev-seed).
// Placeholder rows for local UI work: no disk scanning, no TMDB, no streaming.
// The shape matches the server's buildMovie() output exactly, so these rows can
// be dropped into <MovieCard movie={...}/> or fed to the real filter helpers.

import seed from "./seedMovies.json" with { type: "json" };

// Stable slug id so rows keep identity across reloads (mirrors server idFor()).
function seedId(title, year) {
  const slug = `${title} (${year})`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `seed-${slug}`;
}

const DAY = 24 * 60 * 60 * 1000;
const BASE = Date.parse("2026-01-01T00:00:00.000Z");

export const SEED_FILMS = seed.map((f, i) => ({
  id: seedId(f.title, f.year),
  path: `seed://${f.title} (${f.year}).mp4`,
  title: f.title,
  year: f.year,
  tagline: f.tagline,
  overview: `${f.title} (${f.year}) — placeholder row for local development.`,
  rating: f.rating,
  voteCount: 0,
  genres: f.genres,
  runtime: f.runtime,
  tmdbId: null,
  imdbId: null,
  source: "seed",
  fetchedAt: null,
  kind: "film",
  // Staggered so the "newly added" view is deterministic and inspectable.
  addedAt: BASE - i * DAY,
  hasInfo: true,
  hasPoster: false,
  favorite: false,
  posterUrl: null,
  streamUrl: null,
}));

export const SEED_FILM_COUNT = SEED_FILMS.length;
