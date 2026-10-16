import { useEffect, useMemo } from "react";

export function EpisodesView({ series, client, onClose, onPlay }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const total = (series.episodes || []).length;

  const seasons = useMemo(() => {
    const bySeason = new Map();
    for (const ep of series.episodes || []) {
      const list = bySeason.get(ep.season) || (bySeason.set(ep.season, []), bySeason.get(ep.season));
      list.push(ep);
    }
    return [...bySeason.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([season, episodes]) => ({
        season,
        episodes: episodes.slice().sort((a, b) => a.episode - b.episode),
      }));
  }, [series]);

  return (
    <div className="episodes-view">
      <header className="episodes-top">
        <button className="btn btn-ghost" onClick={onClose}>
          ← Back
        </button>
        <div className="episodes-heading">
          <span className="episodes-series">{series.title}</span>
          <span className="muted">
            {total} episode{total === 1 ? "" : "s"}
          </span>
        </div>
        <button className="player-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>

      <div className="episodes-body">
        {seasons.map(({ season, episodes }) => (
          <section key={season} className="ep-season">
            <h3 className="ep-season-title">Season {season}</h3>
            <ul className="ep-list">
              {episodes.map((ep) => (
                <li key={ep.id} className="ep-row">
                  <button className="ep-play" onClick={() => onPlay(ep, series)} aria-label={`Play ${ep.title}`}>
                    ▶
                  </button>
                  <div className="ep-meta">
                    <span className="ep-line">
                      <span className="ep-code">
                        S{ep.season}E{ep.episode}
                      </span>
                      <span className="ep-name">{ep.title}</span>
                    </span>
                    {ep.overview && <p className="ep-overview">{ep.overview}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
