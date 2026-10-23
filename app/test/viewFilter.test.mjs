import { test } from "node:test";
import assert from "node:assert/strict";
import {
  filterMovies,
  viewCounts,
  smartCollections,
  smartGenres,
  directorList,
  actorList,
  personList,
  sortMovies,
  keepsOwnOrder,
  nextKind,
  KINDS,
  SORTS,
  DEFAULT_SORT,
  DEFAULT_DIR,
} from "../src/viewFilter.mjs";

const MOVIES = [
  { id: "a", kind: "film", favorite: false, watchlist: false, addedAt: 100, directors: ["Alice"], genres: ["Drama"] },
  { id: "b", kind: "film", favorite: true, watchlist: true, addedAt: 50, directors: ["Alice", "Bob"], genres: ["Drama", "Crime"] },
  { id: "c", kind: "series", favorite: false, watchlist: true, addedAt: 300, genres: ["Animation"] },
  { id: "d", kind: "series", favorite: true, watchlist: false, addedAt: 70, genres: ["Animation", "Adventure"] },
  { id: "e", kind: "film", favorite: false, watchlist: false, addedAt: 400, directors: ["Bob"], genres: ["Drama"] },
];

const view = (value) => ({ type: "view", value });

test("filterMovies view 'all' returns every title", () => {
  const got = filterMovies(MOVIES, view("all"), "");
  assert.equal(got.length, 5);
});

test("filterMovies view 'films' returns only non-series", () => {
  const got = filterMovies(MOVIES, view("films"), "");
  assert.equal(got.length, 3);
  assert.ok(got.every((m) => m.kind !== "series"));
});

test("filterMovies view 'series' returns only series", () => {
  const got = filterMovies(MOVIES, view("series"), "");
  assert.equal(got.length, 2);
  assert.ok(got.every((m) => m.kind === "series"));
});

test("filterMovies view 'favorites' returns only favorites", () => {
  const got = filterMovies(MOVIES, view("favorites"), "");
  assert.equal(got.length, 2);
  assert.ok(got.every((m) => m.favorite));
});

test("filterMovies view 'likes' mirrors favorites", () => {
  const got = filterMovies(MOVIES, view("likes"), "");
  assert.deepEqual(got.map((m) => m.id).sort(), ["b", "d"]);
});

test("filterMovies view 'watchlist' returns only watchlisted", () => {
  const got = filterMovies(MOVIES, view("watchlist"), "");
  assert.deepEqual(got.map((m) => m.id).sort(), ["b", "c"]);
});

test("filterMovies view 'diary' sorts by addedAt desc like 'new'", () => {
  const got = filterMovies(MOVIES, view("diary"), "");
  assert.deepEqual(got.map((m) => m.id), ["e", "c", "a", "d", "b"]);
});

test("filterMovies view 'new' sorts by addedAt desc", () => {
  const got = filterMovies(MOVIES, view("new"), "");
  assert.deepEqual(got.map((m) => m.id), ["e", "c", "a", "d", "b"]);
});

test("filterMovies narrows by search query", () => {
  const withTitle = [{ id: "x", kind: "film", title: "Totoro" }, { id: "y", kind: "film", title: "Ponyo" }];
  const got = filterMovies(withTitle, view("films"), "toto");
  assert.deepEqual(got.map((m) => m.id), ["x"]);
});

test("filterMovies by director selection", () => {
  const got = filterMovies(MOVIES, { type: "director", value: "Alice" }, "");
  assert.deepEqual(got.map((m) => m.id).sort(), ["a", "b"]);
});

test("filterMovies by genre selection", () => {
  const got = filterMovies(MOVIES, { type: "genre", value: "Animation" }, "");
  assert.deepEqual(got.map((m) => m.id).sort(), ["c", "d"]);
});

test("directorList accepts the singular director field", () => {
  assert.deepEqual(directorList({ director: "Solo" }), ["Solo"]);
  assert.deepEqual(directorList({ directors: ["A", "B"] }), ["A", "B"]);
  assert.deepEqual(directorList({}), []);
});

test("viewCounts tallies all, films, series, favorites, watchlist and total", () => {
  assert.deepEqual(viewCounts(MOVIES), {
    all: 5,
    films: 3,
    series: 2,
    favorites: 2,
    watchlist: 2,
    new: 5,
  });
});

test("smartCollections surfaces one director for libraries of 30 or fewer", () => {
  const got = smartCollections(MOVIES);
  assert.equal(got.length, 1);
  // Alice directs 2, Bob directs 2 -> tie broken alphabetically.
  assert.equal(got[0].label, "Alice");
  assert.equal(got[0].count, 2);
});

test("smartCollections surfaces two directors once the library exceeds 30", () => {
  const many = Array.from({ length: 31 }, (_, i) => ({ id: `m${i}`, kind: "film", directors: [i < 20 ? "Prolific" : "Rare"] }));
  const got = smartCollections(many);
  assert.equal(got.length, 2);
  assert.deepEqual(got.map((c) => c.label), ["Prolific", "Rare"]);
  assert.equal(got[0].count, 20);
});

test("smartCollections can list every director when max is Infinity", () => {
  const got = smartCollections(MOVIES, { max: Infinity });
  assert.deepEqual(got.map((c) => c.label), ["Alice", "Bob"]);
});

test("smartGenres returns the most common genres, capped at six", () => {
  const got = smartGenres(MOVIES, 6);
  assert.deepEqual(got.map((g) => g.label), ["Drama", "Animation", "Adventure", "Crime"]);
  assert.equal(got[0].count, 3); // Drama appears in a, b, e
  assert.equal(got[1].count, 2); // Animation appears in c, d
});

test("smartGenres caps the list length", () => {
  const got = smartGenres(MOVIES, 2);
  assert.equal(got.length, 2);
});

// --- sort filter -------------------------------------------------------------

const RATED = [
  { id: "low", kind: "film", title: "Zebra", rating: 5.1, year: 1999, runtime: 90 },
  { id: "high", kind: "film", title: "Alpha", rating: 8.9, year: 2010, runtime: 140 },
  { id: "mid", kind: "film", title: "Migration", rating: 7.2, year: 2005, runtime: 105 },
  { id: "unrated", kind: "film", title: "Nobody", rating: null, year: null, runtime: null },
];

test("sortMovies defaults to highest ranking first", () => {
  const got = sortMovies(RATED, DEFAULT_SORT);
  assert.deepEqual(got.map((m) => m.id), ["high", "mid", "low", "unrated"]);
});

test("sortMovies unrated titles sink to the bottom", () => {
  const got = sortMovies(RATED, "ranking");
  assert.equal(got[got.length - 1].id, "unrated");
});

test("sortMovies release date is newest first", () => {
  const got = sortMovies(RATED, "release");
  assert.deepEqual(got.map((m) => m.id), ["high", "mid", "low", "unrated"]);
});

test("sortMovies duration is longest first", () => {
  const got = sortMovies(RATED, "duration");
  assert.deepEqual(got.map((m) => m.id), ["high", "mid", "low", "unrated"]);
});

test("sortMovies alphabetical is A-Z by title", () => {
  // Titles: Alpha, Migration, Nobody, Zebra
  const got = sortMovies(RATED, "alphabetical");
  assert.deepEqual(got.map((m) => m.id), ["high", "mid", "unrated", "low"]);
});

test("SORTS offers the four options and defaults to ranking", () => {
  assert.deepEqual(
    SORTS.map((s) => s.id),
    ["ranking", "release", "duration", "alphabetical"]
  );
  assert.equal(DEFAULT_SORT, "ranking");
  assert.equal(DEFAULT_DIR, null);
});

test("nextKind cycles films -> series -> all -> films", () => {
  assert.deepEqual(KINDS, ["films", "series", "all"]);
  assert.equal(nextKind("films"), "series");
  assert.equal(nextKind("series"), "all");
  assert.equal(nextKind("all"), "films");
  // Unknown values restart the cycle from films.
  assert.equal(nextKind("favorites"), "films");
});

test("sortMovies direction 'desc' reverses alphabetical to Z-A", () => {
  const got = sortMovies(RATED, "alphabetical", "desc");
  assert.deepEqual(got.map((m) => m.id), ["low", "unrated", "mid", "high"]);
});

test("sortMovies direction 'asc' flips ranking to lowest first, unrated still last", () => {
  const got = sortMovies(RATED, "ranking", "asc");
  assert.deepEqual(got.map((m) => m.id), ["low", "mid", "high", "unrated"]);
});

test("sortMovies direction 'asc' flips release to oldest first", () => {
  const got = sortMovies(RATED, "release", "asc");
  assert.deepEqual(got.map((m) => m.id), ["low", "mid", "high", "unrated"]);
});

test("sortMovies direction 'desc' flips alphabetical's natural asc", () => {
  const natural = sortMovies(RATED, "alphabetical");
  const flipped = sortMovies(RATED, "alphabetical", "desc");
  assert.deepEqual(flipped.map((m) => m.id), [...natural.map((m) => m.id)].reverse());
});

test("keepsOwnOrder is true only for the chronological views", () => {
  assert.equal(keepsOwnOrder(view("new")), true);
  assert.equal(keepsOwnOrder(view("diary")), true);
  assert.equal(keepsOwnOrder(view("films")), false);
  assert.equal(keepsOwnOrder(view("favorites")), false);
  assert.equal(keepsOwnOrder({ type: "genre", value: "Drama" }), false);
});

// --- search by people --------------------------------------------------------

test("filterMovies search matches a director, not just the title", () => {
  const list = [
    { id: "x", kind: "film", title: "Some Title", directors: ["Hayao Miyazaki"] },
    { id: "y", kind: "film", title: "Other Film", directors: ["Ridley Scott"] },
  ];
  assert.deepEqual(filterMovies(list, view("films"), "miyazaki").map((m) => m.id), ["x"]);
});

test("filterMovies search matches a top billed actor", () => {
  const list = [
    { id: "x", kind: "film", title: "Howl", cast: [{ name: "Emily Blunt", order: 0 }] },
    { id: "y", kind: "film", title: "Other", cast: ["Tom Hanks"] },
  ];
  assert.deepEqual(filterMovies(list, view("films"), "emily").map((m) => m.id), ["x"]);
  assert.deepEqual(filterMovies(list, view("films"), "hanks").map((m) => m.id), ["y"]);
});

test("filterMovies people search is case-insensitive and title still matches", () => {
  const list = [{ id: "x", kind: "film", title: "Moonrise Kingdom", directors: ["Wes Anderson"], cast: [{ name: "Bruce Willis" }] }];
  assert.deepEqual(filterMovies(list, view("films"), "WES").map((m) => m.id), ["x"]);
  assert.deepEqual(filterMovies(list, view("films"), "kingdom").map((m) => m.id), ["x"]);
  assert.deepEqual(filterMovies(list, view("films"), "willis").map((m) => m.id), ["x"]);
});

test("actorList and personList read both string and object cast entries", () => {
  const m = { directors: ["Wes Anderson"], cast: [{ name: "Bill Murray" }, "Owen Wilson"] };
  assert.deepEqual(actorList(m), ["Bill Murray", "Owen Wilson"]);
  assert.deepEqual(personList(m), ["Wes Anderson", "Bill Murray", "Owen Wilson"]);
  assert.deepEqual(actorList({}), []);
});
