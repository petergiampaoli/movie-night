import { useEffect } from "react";

export function Player({ movie, client, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="player-overlay" onClick={onClose}>
      <div className="player-top" onClick={(e) => e.stopPropagation()}>
        <span className="player-title">{movie.title}</span>
        <span className="muted">{client.host}</span>
        <button className="player-close" onClick={onClose} title="Close player">
          ✕
        </button>
      </div>
      <video
        className="player-video"
        controls
        autoPlay
        src={client.abs(movie.streamUrl)}
        poster={movie.posterUrl ? client.abs(movie.posterUrl) : undefined}
      />
    </div>
  );
}