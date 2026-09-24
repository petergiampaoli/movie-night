// Pure view-model for the hamburger menu.
// Kept dependency-free so it can be unit-tested with `node --test` (no DOM/React).
//
// view: "films" (kind!=="series") | "series" | "favorites" | "new" (newest addedAt first)

export function filterByView(movies, view, query) {
  const q = (query || "").trim().toLowerCase();
  let list = movies;
  if (q) list = list.filter((m) => (m.title || "").toLowerCase().includes(q));
  if (view === "favorites") list = list.filter((m) => m.favorite);
  else if (view === "series") list = list.filter((m) => m.kind === "series");
  else if (view === "films") list = list.filter((m) => m.kind !== "series");
  else if (view === "new") list = list.slice().sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  return list;
}

export function viewCounts(movies, favoriteCount = 0) {
  return {
    films: movies.filter((m) => m.kind !== "series").length,
    series: movies.filter((m) => m.kind === "series").length,
    favorites: favoriteCount,
    new: movies.length,
  };
}
