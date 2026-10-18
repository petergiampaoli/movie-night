export function MovieCard({ movie, client, onOpen, onGetInfo, onToggleFavorite, onToggleWatchlist }) {
  const initials = (movie.title || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div
      className={`card ${!movie.hasInfo ? "card-unmet" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(movie)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(movie);
        }
      }}
    >
      <button
        className={`fav-btn ${movie.favorite ? "on" : ""}`}
        title={movie.favorite ? "Remove from favorites" : "Save to favorites"}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(movie);
        }}
      >
        ♥
      </button>

      <button
        className={`watch-btn ${movie.watchlist ? "on" : ""}`}
        title={movie.watchlist ? "Remove from watchlist" : "Add to watchlist"}
        onClick={(e) => {
          e.stopPropagation();
          onToggleWatchlist?.(movie);
        }}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M7 3h10a1 1 0 0 1 1 1v16.2a.8.8 0 0 1-1.24.67L12 17.4l-4.76 3.47A.8.8 0 0 1 6 20.2V4a1 1 0 0 1 1-1Z"
          />
        </svg>
      </button>

      <div className="poster">
        {movie.posterUrl ? (
          <img src={client.abs(movie.posterUrl)} alt={movie.title} loading="lazy" />
        ) : (
          <div className="poster-placeholder">
            <span className="initials">{initials}</span>
            <span className="card-play">▶</span>
          </div>
        )}
        <div className="card-hover-play">▶ Play</div>
        {movie.kind === "series" && <span className="series-chip">Series</span>}
      </div>

      <div className="card-meta">
        <div className="card-title" title={movie.title}>
          {movie.title}
        </div>
        <div className="card-sub">
          {movie.year || "—"}
          {movie.kind === "series" && <span className="ep-count">{(movie.episodes || []).length} ep</span>}
          {movie.rating != null && <span className="star">★ {movie.rating.toFixed(1)}</span>}
          {!movie.hasInfo && <span className="no-info-chip">No info</span>}
        </div>
      </div>

      {!movie.hasInfo && (
        <button
          className="get-info"
          title="Fetch poster and movie information from TheMovieDB (requires your permission)"
          onClick={(e) => {
            e.stopPropagation();
            onGetInfo(movie);
          }}
        >
          Get movie information
        </button>
      )}
    </div>
  );
}