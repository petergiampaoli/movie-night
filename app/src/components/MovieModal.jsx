import { useEffect, useRef } from "react";
import { directorList, actorList } from "../viewFilter.mjs";

export function MovieModal({
  movie,
  client,
  onClose,
  onPlay,
  onToggleFavorite,
  onToggleWatchlist,
  onGetInfo,
  onViewEpisodes,
  onSearchPerson,
}) {
  const backdropRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    backdropRef.current?.focus();
  }, []);

  const m = movie;
  const directors = directorList(m);
  const cast = actorList(m).slice(0, 8);
  const people = [
    ...directors.map((name) => ({ name, role: "Director" })),
    ...cast.map((name) => ({ name, role: "Cast" })),
  ];
  const posterInline = m.posterUrl ? { backgroundImage: `url(${client.abs(m.posterUrl)})` } : {};
  const initials = (m.title || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const externalLinks = [];
  if (m.imdbId) {
    externalLinks.push({
      label: "IMDb",
      url: `https://www.imdb.com/title/${m.imdbId}/`,
    });
    externalLinks.push({
      label: "Letterboxd",
      url: `https://letterboxd.com/imdb/${m.imdbId}/`,
    });
  } else if (m.title) {
    const slug = m.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    externalLinks.push({ label: "Letterboxd", url: `https://letterboxd.com/search/films/${slug}` });
  }

  return (
    <div className="modal-backdrop" ref={backdropRef} tabIndex={-1} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-hero" style={posterInline}>
          <div className="modal-poster">
            {m.posterUrl ? (
              <img src={client.abs(m.posterUrl)} alt={m.title} />
            ) : (
              <div className="poster-placeholder">
                <span className="initials">{initials}</span>
              </div>
            )}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
          <div className="modal-headline">
            <h1>{m.title}</h1>
            <div className="meta-line">
              <span className="year">{m.year || "—"}</span>
              {m.kind === "series" && <span className="kind-badge">Series</span>}
              {m.kind === "series"
                ? <span>{(m.episodes || []).length} episodes</span>
                : m.runtime ? <span>{Math.round(m.runtime)} min</span> : null}
              {m.genres?.length ? <span className="genres">{m.genres.join(", ")}</span> : null}
            </div>
          </div>
        </div>

        <div className="modal-body">
          <div className="actions">
            {m.kind === "series" ? (
              <button className="btn btn-play" onClick={() => onViewEpisodes(m)} disabled={!(m.episodes || []).length}>
                ▶ View all episodes
              </button>
            ) : (
              <button className="btn btn-play" onClick={() => onPlay(m)} disabled={!m.streamUrl}>
                ▶ Play
              </button>
            )}
            <button className={`btn btn-fav ${m.favorite ? "on" : ""}`} onClick={onToggleFavorite}>
              {m.favorite ? "♥ In Favorites" : "♡ Save to Favorites"}
            </button>
            <button
              className={`btn btn-watch ${m.watchlist ? "on" : ""}`}
              onClick={onToggleWatchlist}
              title="Add this title to your watchlist"
            >
              {m.watchlist ? "🔖 In Watchlist" : "🔖 Add to Watchlist"}
            </button>
            {externalLinks.map((l) => (
              <button
                key={l.label}
                className="btn btn-ghost"
                onClick={() => window.movienight?.openExternal(l.url)}
              >
                {l.label} ↗
              </button>
            ))}
          </div>

          {!m.hasInfo && (
            <div className="missing-panel">
              <p>
                Movie information for this film is missing. You can fetch a poster, synopsis, tagline and
                ratings from TheMovieDB — you'll be asked to confirm before anything is written.
              </p>
              <button className="btn btn-primary" onClick={() => onGetInfo(m)}>
                Get movie information
              </button>
            </div>
          )}

          {m.hasInfo && m.tagline && <p className="tagline">“{m.tagline}”</p>}

          <div className="ratings">
            {m.rating != null && (
              <div className="rating">
                <span className="rating-score">★ {m.rating.toFixed(1)}</span>
                <span className="rating-source">
                  TheMovieDB{m.voteCount ? ` · ${m.voteCount.toLocaleString()} votes` : ""}
                </span>
              </div>
            )}
          </div>

          {people.length > 0 && (
            <div className="people">
              <div className="people-row">
                <span className="people-label">Director</span>
                <span className="people-links">
                  {directors.map((name) => (
                    <button
                      key={name}
                      className="person-chip"
                      onClick={() => onSearchPerson?.(name)}
                      title={`Search the library for ${name}`}
                    >
                      {name}
                    </button>
                  ))}
                </span>
              </div>
              {cast.length > 0 && (
                <div className="people-row">
                  <span className="people-label">Top billed</span>
                  <span className="people-links">
                    {cast.map((name) => (
                      <button
                        key={name}
                        className="person-chip"
                        onClick={() => onSearchPerson?.(name)}
                        title={`Search the library for ${name}`}
                      >
                        {name}
                      </button>
                    ))}
                  </span>
                </div>
              )}
            </div>
          )}

          {m.overview ? (
            <div className="synopsis">
              <h3>Synopsis</h3>
              <p>{m.overview}</p>
            </div>
          ) : (
            <p className="dim">No synopsis yet.</p>
          )}

          {m.kind === "series" && (m.episodes || []).length > 0 && (
            <div className="episodes-section">
              <div className="episodes-section-head">
                <h3>Episodes</h3>
                <span className="muted">{m.episodes.length} total</span>
              </div>
              <ul className="ep-preview">
                {m.episodes.slice(0, 4).map((ep) => (
                  <li key={ep.id} className="ep-preview-row">
                    <span className="ep-code">
                      S{ep.season}E{ep.episode}
                    </span>
                    <span className="ep-name">{ep.title}</span>
                  </li>
                ))}
              </ul>
              {m.episodes.length > 4 && (
                <p className="dim">+{m.episodes.length - 4} more episodes</p>
              )}
              <button className="btn btn-ghost" onClick={() => onViewEpisodes(m)}>
                View all episodes
              </button>
            </div>
          )}

          <div className="file-info">
            <span>Source file:</span> <code>{m.path}</code>
            {m.source && <span className="source-badge">info from {m.source}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}