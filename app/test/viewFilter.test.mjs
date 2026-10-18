import { test } from "node:test";
import assert from "node:assert/strict";
import {
  filterMovies,
  viewCounts,
  smartCollections,
  smartGenres,
  directorList,
} from "../src/viewFilter.mjs";

const MOVIES = [
  { id: "a", kind: "film", favorite: false, watchlist: false, addedAt: 100, directors: ["Alice"], genres: ["Drama"] },
  { id: "b", kind: "film", favorite: true, watchlist: true, addedAt: 50, directors: ["Alice", "Bob"], genres: ["Drama", "Crime"] },
  { id: "c", kind: "series", favorite: false, watchlist: true, addedAt: 300, genres: ["Animation"] },
  { id: "d", kind: "series", favorite: true, watchlist: false, addedAt: 70, genres: ["Animation", "Adventure"] },
  { id: "e", kind: "film", favorite: false, watchlist: false, addedAt: 400, directors: ["Bob"], genres: ["Drama"] },
];

const view = (value) => ({ type: "view", value });

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

test("viewCounts tallies films, series, favorites, watchlist and total", () => {
  assert.deepEqual(viewCounts(MOVIES), { films: 3, series: 2, favorites: 2, watchlist: 2, new: 5 });
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
