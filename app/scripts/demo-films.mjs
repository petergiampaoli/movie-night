// The demo library: every theatrical feature directed by Wes Anderson or
// Hayao Miyazaki. Used by scripts/build-demo-data.mjs to fetch TMDB metadata
// and bake it into app/demo-data (the set the port-1234 demo server serves).
//
// title/year are the TMDB search keys. director is kept for reference/validation.

export const FILMS = [
  // --- Wes Anderson ---------------------------------------------------------
  { title: "Bottle Rocket", year: 1996, director: "Wes Anderson" },
  { title: "Rushmore", year: 1998, director: "Wes Anderson" },
  { title: "The Royal Tenenbaums", year: 2001, director: "Wes Anderson" },
  { title: "The Life Aquatic with Steve Zissou", year: 2004, director: "Wes Anderson" },
  { title: "The Darjeeling Limited", year: 2007, director: "Wes Anderson" },
  { title: "Fantastic Mr. Fox", year: 2009, director: "Wes Anderson" },
  { title: "Moonrise Kingdom", year: 2012, director: "Wes Anderson" },
  { title: "The Grand Budapest Hotel", year: 2014, director: "Wes Anderson" },
  { title: "Isle of Dogs", year: 2018, director: "Wes Anderson" },
  { title: "The French Dispatch", year: 2021, director: "Wes Anderson" },
  { title: "Asteroid City", year: 2023, director: "Wes Anderson" },
  { title: "The Phoenician Scheme", year: 2025, director: "Wes Anderson" },

  // --- Hayao Miyazaki -------------------------------------------------------
  { title: "Lupin III: The Castle of Cagliostro", year: 1979, director: "Hayao Miyazaki" },
  { title: "Nausicaä of the Valley of the Wind", year: 1984, director: "Hayao Miyazaki" },
  { title: "Castle in the Sky", year: 1986, director: "Hayao Miyazaki" },
  { title: "My Neighbor Totoro", year: 1988, director: "Hayao Miyazaki" },
  { title: "Kiki's Delivery Service", year: 1989, director: "Hayao Miyazaki" },
  { title: "Porco Rosso", year: 1992, director: "Hayao Miyazaki" },
  { title: "Princess Mononoke", year: 1997, director: "Hayao Miyazaki" },
  { title: "Spirited Away", year: 2001, director: "Hayao Miyazaki" },
  { title: "Howl's Moving Castle", year: 2004, director: "Hayao Miyazaki" },
  { title: "Ponyo", year: 2008, director: "Hayao Miyazaki" },
  { title: "The Wind Rises", year: 2013, director: "Hayao Miyazaki" },
  { title: "The Boy and the Heron", year: 2023, director: "Hayao Miyazaki" },
];

// Series in the demo library. `seasons` maps a season number to the episode
// numbers we bake in (kept small; TMDB supplies the episode titles/overviews).
export const SERIES = [
  {
    title: "Adventure Time",
    year: 2010,
    seasons: { 1: [1, 2, 3], 2: [1, 2, 3] },
  },
];

// Folder/file-safe name (colons and slashes break paths on some platforms).
export function safeName(film) {
  return `${film.title.replace(/[:/]/g, " -")} (${film.year})`;
}

export function safeFileName(name) {
  return name.replace(/[:/]/g, " -");
}
