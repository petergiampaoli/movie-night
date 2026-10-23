// Pure view-model for the left accordion navigation.
// Kept dependency-free so it can be unit-tested with `node --test` (no DOM/React).
//
// A "selection" describes what the sidebar has narrowed the grid to:
//   { type: "view",   value: "all" | "films" | "series" | "new" | "favorites" | "watchlist" | "diary" | "likes" }
//   { type: "director", value: "Wes Anderson" }   (Smart Collections)
//   { type: "genre",    value: "Animation" }      (Smart Genres)
//
// The user menu maps Letterboxd-style entries onto these views:
//   Profile/Settings/Lists/Tags/Reviews -> full-screen panels (not filters)
//   Diary  -> the "diary" view (chronological, same ordering as "new")
//   Likes  -> the "likes" view (favourites)
//   Watchlist -> the "watchlist" view

export function directorList(movie) {
  if (Array.isArray(movie?.directors) && movie.directors.length) return movie.directors;
  if (movie?.director) return [movie.director];
  return [];
}

// Top billed actors, in billing order (server stores TMDB's credits.cast).
export function actorList(movie) {
  const cast = Array.isArray(movie?.cast) ? movie.cast : [];
  return cast
    .map((c) => (typeof c === "string" ? c : c?.name))
    .filter(Boolean);
}

// Every searchable person attached to a title: director(s) then top billed cast.
export function personList(movie) {
  return [...directorList(movie), ...actorList(movie)];
}

// The search box matches people as well as titles, so typing a director or a
// lead actor surfaces everything they appear in.
function matchesQuery(movie, q) {
  if ((movie.title || "").toLowerCase().includes(q)) return true;
  return personList(movie).some((name) => name.toLowerCase().includes(q));
}

// --- kind cycling ----------------------------------------------------------
// The icon in the grid header rotates Films -> Series -> All.
export const KINDS = ["films", "series", "all"];
export const KIND_ICONS = { films: "🎬", series: "📺", all: "🎞️" };

export function nextKind(current) {
  const i = KINDS.indexOf(current);
  return KINDS[(i < 0 ? 0 : i + 1) % KINDS.length];
}

// --- sorting ---------------------------------------------------------------
// The library filter (top-right of the grid) picks an ordering.
export const DEFAULT_SORT = "ranking";
export const SORTS = [
  { id: "ranking", label: "Highest ranking" },
  { id: "release", label: "Release date" },
  { id: "duration", label: "Duration" },
  { id: "alphabetical", label: "Alphabetical" },
];

// The direction caret starts neutral (↕); picking a direction sticks.
export const DEFAULT_DIR = null;
export const DIR_GLYPHS = { desc: "▼", asc: "▲" };
export const DIR_TITLES = {
  neutral: "Sort direction: pick descending (▼) or ascending (▲)",
  desc: "Sorted descending — click for ascending",
  asc: "Sorted ascending — click for descending",
};

const byTitle = (a, b) =>
  String(a.title || "").localeCompare(String(b.title || ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });

// Missing numbers are always held back to the bottom, whichever direction.
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

// Ascending comparators; direction is applied by flipping the sign.
const ASC = {
  ranking: (a, b) => num(a.rating) - num(b.rating),
  release: (a, b) => num(a.year) - num(b.year),
  duration: (a, b) => num(a.runtime) - num(b.runtime),
  alphabetical: byTitle,
};

// Each sort's natural direction (used until the caret is toggled).
const NATURAL_DIR = {
  ranking: "desc",
  release: "desc",
  duration: "desc",
  alphabetical: "asc",
};

const hasKey = (sort, m) => {
  if (sort === "alphabetical") return true;
  const v = sort === "release" ? m.year : sort === "duration" ? m.runtime : m.rating;
  return num(v) !== null;
};

export function sortMovies(list, sort = DEFAULT_SORT, dir = DEFAULT_DIR) {
  const base = ASC[sort] || ASC.ranking;
  const direction = dir === "asc" || dir === "desc" ? dir : NATURAL_DIR[sort] || "desc";
  const sign = direction === "asc" ? 1 : -1;
  const present = list.filter((m) => hasKey(sort, m));
  const missing = list.filter((m) => !hasKey(sort, m));
  present.sort((a, b) => base(a, b) * sign || byTitle(a, b));
  return present.concat(missing);
}

// Views whose order is the point of the view (chronological) ignore the sort.
export function keepsOwnOrder(selection) {
  return (
    selection?.type === "view" &&
    (selection.value === "new" || selection.value === "diary")
  );
}

export function filterMovies(movies, selection, query) {
  const q = (query || "").trim().toLowerCase();
  let list = movies;
  if (q) list = list.filter((m) => matchesQuery(m, q));

  const sel = selection || { type: "view", value: "all" };
  if (sel.type === "director") {
    list = list.filter((m) => directorList(m).includes(sel.value));
  } else if (sel.type === "genre") {
    list = list.filter((m) => (m.genres || []).includes(sel.value));
  } else {
    switch (sel.value) {
      case "favorites":
        list = list.filter((m) => m.favorite);
        break;
      case "likes":
        list = list.filter((m) => m.favorite);
        break;
      case "watchlist":
        list = list.filter((m) => m.watchlist);
        break;
      case "series":
        list = list.filter((m) => m.kind === "series");
        break;
      case "films":
        list = list.filter((m) => m.kind !== "series");
        break;
      case "all":
        break;
      case "new":
        list = list.slice().sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
        break;
      case "diary":
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
    all: movies.length,
    films: movies.filter((m) => m.kind !== "series").length,
    series: movies.filter((m) => m.kind === "series").length,
    favorites: movies.filter((m) => m.favorite).length,
    watchlist: movies.filter((m) => m.watchlist).length,
    new: movies.length,
  };
}

// Smart Collections: the top directors by number of films.
// Rule: libraries of 30 films or fewer surface one director; larger ones surface two.
// Pass { max } to override the cap (e.g. Infinity to list every director).
export function smartCollections(movies, { threshold = 30, max } = {}) {
  const counts = new Map();
  for (const m of movies) {
    for (const d of directorList(m)) counts.set(d, (counts.get(d) || 0) + 1);
  }
  const ranked = [...counts.entries()]
    .map(([label, count]) => ({ id: `dir:${label}`, label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const cap = max != null ? max : movies.length > threshold ? 2 : 1;
  return ranked.slice(0, cap);
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
