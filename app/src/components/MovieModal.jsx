import { useEffect, useRef } from "react";

export function MovieModal({ movie, client, onClose, onPlay, onToggleFavorite, onGetInfo }) {
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
              {m.runtime ? <span>{Math.round(m.runtime)} min</span> : null}
              {m.genres?.length ? <span className="genres">{m.genres.join(", ")}</span> : null}
            </div>
          </div>
        </div>

        <div className="modal-body">
          <div className="actions">
            <button className="btn btn-play" onClick={() => onPlay(m)} disabled={!m.streamUrl}>
              ▶ Play
            </button>
            <button className={`btn btn-fav ${m.favorite ? "on" : ""}`} onClick={onToggleFavorite}>
              {m.favorite ? "♥ In Favorites" : "♡ Save to Favorites"}
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

          {m.overview ? (
            <div className="synopsis">
              <h3>Synopsis</h3>
              <p>{m.overview}</p>
            </div>
          ) : (
            <p className="dim">No synopsis yet.</p>
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