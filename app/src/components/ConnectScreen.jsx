import { useState } from "react";

export function ConnectScreen({ busy, error, onLocal, onRemote }) {
  const [url, setUrl] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (!url.trim() || busy) return;
    onRemote(url);
  };

  return (
    <div className="connect-screen">
      <div className="connect-hero">
        <div className="logo logo-big">
          local<span>flix</span>
        </div>
        <p className="tagline">A Netflix-style way to watch the movies you already own.</p>
      </div>

      <div className="connect-panels">
        <section className="connect-card">
          <div className="connect-icon">📁</div>
          <h2>Browse a local folder</h2>
          <p>
            Pick a folder of movie files on this machine. movienight starts a local server, scans the
            folder, and streams straight to this app.
          </p>
          <button className="btn btn-primary" disabled={busy} onClick={onLocal}>
            {busy ? "Starting…" : "Choose folder"}
          </button>
        </section>

        <section className="connect-card">
          <div className="connect-icon">🖧</div>
          <h2>Connect to a server</h2>
          <p>
            Point the app at a movienight Node media server on your network, e.g.{" "}
            <code>http://192.168.1.20:8787</code>.
          </p>
          <form onSubmit={submit}>
            <input
              className="url-input"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://host:port"
              disabled={busy}
              spellCheck={false}
            />
            <button className="btn btn-primary" type="submit" disabled={busy || !url.trim()}>
              {busy ? "Connecting…" : "Connect"}
            </button>
          </form>
        </section>
      </div>

      {error && <div className="error-banner connect-error">{error}</div>}
      <p className="connect-note">
        Metadata (posters, synopsis, ratings) is optional and only ever fetched from TheMovieDB after
        you explicitly allow it.
      </p>
    </div>
  );
}