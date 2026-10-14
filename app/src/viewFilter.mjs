// Pure view-model for the left accordion navigation.
// Kept dependency-free so it can be unit-tested with `node --test` (no DOM/React).
//
// A "selection" describes what the sidebar has narrowed the grid to:
//   { type: "view",   value: "films" | "series" | "new" | "favorites" }
//   { type: "director", value: "Wes Anderson" }   (Smart Collections)
//   { type: "genre",    value: "Animation" }      (Smart Genres)

export function directorList(movie) {
  if (Array.isArray(movie?.directors) && movie.directors.length) return movie.directors;
  if (movie?.director) return [movie.director];
  return [];
}

export function filterMovies(movies, selection, query) {
  const q = (query || "").trim().toLowerCase();
  let list = movies;
  if (q) list = list.filter((m) => (m.title || "").toLowerCase().includes(q));

  const sel = selection || { type: "view", value: "films" };
  if (sel.type === "director") {
    list = list.filter((m) => directorList(m).includes(sel.value));
  } else if (sel.type === "genre") {
    list = list.filter((m) => (m.genres || []).includes(sel.value));
  } else {
    switch (sel.value) {
      case "favorites":
        list = list.filter((m) => m.favorite);
        break;
      case "series":
        list = list.filter((m) => m.kind === "series");
        break;
      case "films":
        list = list.filter((m) => m.kind !== "series");
        break;
      case "new":
        list = list.slice().sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
        break;
      default:
        break;
    }
  }
  return list;
}

export function viewCounts(movies) {
  return {
    films: movies.filter((m) => m.kind !== "series").length,
    series: movies.filter((m) => m.kind === "series").length,
    favorites: movies.filter((m) => m.favorite).length,
    new: movies.length,
  };
}

// Smart Collections: the top directors by number of films.
// Rule: libraries of 30 films or fewer surface one director; larger ones surface two.
export function smartCollections(movies, { threshold = 30 } = {}) {
  const counts = new Map();
  for (const m of movies) {
    for (const d of directorList(m)) counts.set(d, (counts.get(d) || 0) + 1);
  }
  const ranked = [...counts.entries()]
    .map(([label, count]) => ({ id: `dir:${label}`, label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const max = movies.length > threshold ? 2 : 1;
  return ranked.slice(0, max);
}

// Smart Genres: the most common genres across the library (default: top 6).
export function smartGenres(movies, max = 6) {
  const counts = new Map();
  for (const m of movies) {
    for (const g of m.genres || []) counts.set(g, (counts.get(g) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ id: `genre:${label}`, label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, max);
}
