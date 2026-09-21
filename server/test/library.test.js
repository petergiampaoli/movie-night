const test = require("node:test");
const assert = require("node:assert");
const { cleanTitle, guessYear } = require("../src/library");

test("cleanTitle strips extensions, tags and release groups", () => {
  assert.equal(cleanTitle("The Grand Budapest Hotel_2014_1080p.mkv"), "The Grand Budapest Hotel 2014");
  assert.equal(cleanTitle("[BluRay] Asteroid City.mkv"), "Asteroid City");
  assert.equal(cleanTitle("Isle.of.Dogs.2018.WEBRip.x264.mp4"), "Isle of Dogs 2018");
  assert.equal(cleanTitle("Rushmore.mov"), "Rushmore");
});

test("guessYear finds 19xx/20xx", () => {
  assert.equal(guessYear("Fantastic Mr. Fox (2009).mkv"), 2009);
  assert.equal(guessYear("Cannes 1946 dump.avi"), 1946);
  assert.equal(guessYear("No Year Here.mkv"), null);
});