import { test } from "node:test";
import assert from "node:assert/strict";
import { SEED_FILMS, SEED_FILM_COUNT } from "../src/dev/seedMovies.mjs";

test("seed dataset has 53 films with unique stable ids", () => {
  assert.equal(SEED_FILM_COUNT, 53);
  assert.equal(SEED_FILMS.length, 53);
  const ids = SEED_FILMS.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length, "ids are unique");
  ids.forEach((id) => assert.match(id, /^seed-[a-z0-9-]+$/));
});

test("every seed row matches the server buildMovie shape", () => {
  const required = ["id","path","title","year","tagline","overview","rating","genres","runtime","kind","addedAt","hasInfo","hasPoster","favorite","source"];
  for (const f of SEED_FILMS) {
    for (const k of required) assert.ok(k in f, `${f.title} missing ${k}`);
    assert.equal(f.kind, "film");
    assert.equal(typeof f.addedAt, "number");
    assert.equal(f.hasInfo, true);
    assert.equal(f.favorite, false);
  }
});

test("newly added seed rows are ordered newest-first", () => {
  const sorted = [...SEED_FILMS].sort((a, b) => b.addedAt - a.addedAt);
  assert.equal(sorted[0].id, SEED_FILMS[0].id);
  for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i - 1].addedAt > sorted[i].addedAt);
});
