export function MovieCard({ movie, client, onOpen, onGetInfo, onToggleFavorite }) {
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
      </div>

      <div className="card-meta">
        <div className="card-title" title={movie.title}>
          {movie.title}
        </div>
        <div className="card-sub">
          {movie.year || "—"}
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