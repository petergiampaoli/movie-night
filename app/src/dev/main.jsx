// Development-only entry point (branch: dev-seed).
// Run with:  npm run dev        ->  http://127.0.0.1:5173/dev.html
// Renders placeholder cards for the seed film list using the real MovieCard
// component, so card layout/metadata can be iterated without a real library.

import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { MovieCard } from "./../components/MovieCard.jsx";
import { filterMovies } from "./../viewFilter.mjs";
import { SEED_FILMS, SEED_FILM_COUNT } from "./seedMovies.mjs";
import "./../style.css";

// Minimal stand-in for the real API client used by MovieCard (`client.abs`).
const stubClient = {
  abs: (p) => p,
  on: () => () => {},
  off: () => {},
};

const VIEWS = [
  ["films", "Films"],
  ["series", "Series"],
  ["favorites", "Favorites"],
  ["new", "New"],
];

function DevSeedGallery() {
  const [films, setFilms] = useState(SEED_FILMS);
  const [view, setView] = useState("films");
  const [query, setQuery] = useState("");

  const toggleFavorite = (movie) =>
    setFilms((list) => list.map((m) => (m.id === movie.id ? { ...m, favorite: !m.favorite } : m)));

  const visible = useMemo(
    () => filterMovies(films, { type: "view", value: view }, query),
    [films, view, query]
  );
  const favoriteCount = films.filter((m) => m.favorite).length;

  return (
    <div className="app">
      <div className="content" style={{ padding: "24px 28px" }}>
        <h1 style={{ margin: "0 0 4px", fontSize: 24 }}>Dev seed data</h1>
        <p className="dim" style={{ margin: "0 0 18px" }}>
          {SEED_FILM_COUNT} placeholder films · no server, no TMDB, no streaming.
        </p>

        <div className="search" style={{ maxWidth: 420, margin: "0 0 14px" }}>
          <span className="search-icon">⌕</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search seed films…" />
          {query && (
            <button className="clear" onClick={() => setQuery("")} aria-label="Clear search">
              ✕
            </button>
          )}
        </div>

        <div className="row" style={{ marginBottom: 18 }}>
          {VIEWS.map(([id, label]) => (
            <button key={id} className={`btn btn-ghost${view === id ? " on" : ""}`} onClick={() => setView(id)}>
              {label}
              {id === "favorites" && favoriteCount > 0 ? ` · ${favoriteCount}` : ""}
            </button>
          ))}
        </div>

        <h2 className="row-title">
          {label(view)} <span className="count-badge">{visible.length}</span>
        </h2>

        {visible.length === 0 ? (
          <p className="dim">Nothing matches.</p>
        ) : (
          <div className="grid">
            {visible.map((movie) => (
              <MovieCard
                key={movie.id}
                movie={movie}
                client={stubClient}
                onOpen={(m) => window.alert(`${m.title} (${m.year})`)}
                onGetInfo={() => window.alert("Meta fetch is disabled in dev seed mode.")}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function label(view) {
  return { films: "Films", series: "Series", favorites: "Favorites", new: "New" }[view] || "Films";
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <DevSeedGallery />
  </React.StrictMode>
);
