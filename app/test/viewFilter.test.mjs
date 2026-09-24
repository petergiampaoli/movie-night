import { test } from "node:test";
import assert from "node:assert/strict";
import { filterByView, viewCounts } from "../src/viewFilter.mjs";

const MOVIES = [
  { id: "a", kind: "film", favorite: false, addedAt: 100 },
  { id: "b", kind: "film", favorite: true, addedAt: 50 },
  { id: "c", kind: "series", favorite: false, addedAt: 300 },
  { id: "d", kind: "series", favorite: true, addedAt: 70 },
  { id: "e", kind: "film", favorite: false, addedAt: 400 },
];

test("filterByView default (films) returns only non-series", () => {
  const got = filterByView(MOVIES, "films", "");
  assert.equal(got.length, 3);
  assert.ok(got.every((m) => m.kind !== "series"));
});

test("filterByView series view returns only series", () => {
  const got = filterByView(MOVIES, "series", "");
  assert.equal(got.length, 2);
  assert.ok(got.every((m) => m.kind === "series"));
});

test("filterByView favorites view returns only favorites", () => {
  const got = filterByView(MOVIES, "favorites", "");
  assert.equal(got.length, 2);
  assert.ok(got.every((m) => m.favorite));
});

test("filterByView new view sorts by addedAt desc", () => {
  const got = filterByView(MOVIES, "new", "");
  assert.deepEqual(got.map((m) => m.id), ["e", "c", "a", "d", "b"]);
});

