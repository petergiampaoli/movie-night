import { useEffect, useMemo } from "react";
import { UserIcon, libraryIdentity } from "./UserMenu.jsx";

// Full-screen panel behind the user menu entries that aren't simple views:
//   profile  -> connection identity + library stats
//   settings -> connection details + disconnect
//   lists    -> Smart Collections (directors) + Smart Genres as tiles
//   tags     -> every genre in the library as a clickable tag
//   reviews  -> empty state (Movie Night is a player, not a review site)
const TITLES = {
  profile: "Profile",
  settings: "Settings",
  lists: "Lists",
  tags: "Tags",
  reviews: "Reviews",
};

function Stat({ label, value }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

export function UserPanel({
  kind,
  conn,
  movies,
  counts,
  collections,
  genres,
  onSelect,
  onDisconnect,
  onClose,
}) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { name, subtitle } = libraryIdentity(conn);

  const allGenres = useMemo(() => {
    const countsByGenre = new Map();
    for (const m of movies) {
      for (const g of m.genres || []) countsByGenre.set(g, (countsByGenre.get(g) || 0) + 1);
    }
    return [...countsByGenre.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [movies]);

  const pick = (selection) => {
    onSelect(selection);
    onClose();
  };

  return (
    <div className="panel-view">
      <header className="panel-top">
        <button className="btn btn-ghost" onClick={onClose}>
          ← Back
        </button>
        <div className="panel-heading">
          <span className="panel-title">{TITLES[kind] || ""}</span>
        </div>
        <button className="player-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>

      <div className="panel-body">
        {kind === "profile" && (
          <>
            <div className="profile-hero">
              <span className="user-avatar xl">
                <UserIcon />
              </span>
              <div className="profile-id">
                <span className="profile-name">{name}</span>
                <span className="profile-sub">{subtitle}</span>
              </div>
            </div>
            <div className="stat-grid">
              <Stat label="Films" value={counts.films} />
              <Stat label="Series" value={counts.series} />
              <Stat label="Favorites" value={counts.favorites} />
              <Stat label="Watchlist" value={counts.watchlist} />
              <Stat label="In library" value={counts.new} />
              <Stat label="Genres" value={allGenres.length} />
            </div>
          </>
        )}

        {kind === "settings" && (
          <>
            <div className="info-list">
              <div className="info-row">
                <span className="info-key">Connection</span>
                <span className="info-val">{subtitle}</span>
              </div>
              <div className="info-row">
                <span className="info-key">Server URL</span>
                <code className="info-val">{conn.baseUrl}</code>
              </div>
              <div className="info-row">
                <span className="info-key">Library folder</span>
                <code className="info-val">{conn.movieDir || "—"}</code>
              </div>
              <div className="info-row">
                <span className="info-key">Items</span>
                <span className="info-val">{counts.new}</span>
              </div>
            </div>
            <button className="btn btn-danger" onClick={onDisconnect}>
              Disconnect from server
            </button>
          </>
        )}

        {kind === "lists" && (
          <>
            <section className="panel-section">
              <h3 className="panel-section-title">Smart Collections</h3>
              {collections.length === 0 ? (
                <p className="dim">No director data yet.</p>
              ) : (
                <div className="tile-grid">
                  {collections.map((c) => (
                    <button
                      key={c.id}
                      className="tile"
                      onClick={() => pick({ type: "director", value: c.label })}
                    >
                      <span className="tile-label">{c.label}</span>
                      <span className="tile-count">{c.count}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
            <section className="panel-section">
              <h3 className="panel-section-title">Smart Genres</h3>
              {genres.length === 0 ? (
                <p className="dim">No genre data yet.</p>
              ) : (
                <div className="tile-grid">
                  {genres.map((g) => (
                    <button
                      key={g.id}
                      className="tile"
                      onClick={() => pick({ type: "genre", value: g.label })}
                    >
                      <span className="tile-label">{g.label}</span>
                      <span className="tile-count">{g.count}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {kind === "tags" && (
          <section className="panel-section">
            <h3 className="panel-section-title">All tags</h3>
            {allGenres.length === 0 ? (
              <p className="dim">No tag data yet.</p>
            ) : (
              <div className="tag-cloud">
                {allGenres.map((g) => (
                  <button
                    key={g.label}
                    className="tag"
                    onClick={() => pick({ type: "genre", value: g.label })}
                  >
                    {g.label}
                    <span className="tag-count">{g.count}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {kind === "reviews" && (
          <div className="panel-empty">
            <div className="panel-empty-icon">★</div>
            <h3>No reviews yet</h3>
            <p>
              Movie Night plays your library — it doesn't collect reviews. Browse your films and
              save the ones you love to "Likes" instead.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => pick({ type: "view", value: "films" })}
            >
              Browse films
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
