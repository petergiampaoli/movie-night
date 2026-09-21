import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { ConnectScreen } from "./components/ConnectScreen.jsx";
import { TopBar } from "./components/TopBar.jsx";
import { MovieCard } from "./components/MovieCard.jsx";
import { MovieModal } from "./components/MovieModal.jsx";
import { Player } from "./components/Player.jsx";
import { ConfirmDialog } from "./components/ConfirmDialog.jsx";
import { Toast } from "./components/Toast.jsx";

export default function App() {
  const [conn, setConn] = useState(null); // { baseUrl, source: 'local'|'remote', movieDir }
  const [busy, setBusy] = useState(false);
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [modalMovie, setModalMovie] = useState(null);
  const [playing, setPlaying] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(null);

  const client = useMemo(() => (conn ? api(conn.baseUrl) : null), [conn]);

  const notify = useCallback((msg, kind = "ok") => setToast({ msg, kind }), []);

  const loadMovies = useCallback(
    async (onlyFavs = favoritesOnly) => {
      if (!client) return;
      setLoading(true);
      try {
        const data = await client.movies(onlyFavs);
        setMovies(data.movies || []);
      } catch (err) {
        setError(err.message);
        notify(err.message, "error");
      } finally {
        setLoading(false);
      }
    },
    [client, favoritesOnly, notify]
  );

  // Always keep a latest reference so effects below can hold a stable dep.
  const moviesRef = useRef(loadMovies);
  moviesRef.current = loadMovies;

  // Listen for the local server going away (e.g. it crashed or was stopped).
  useEffect(() => {
    if (!window.movienight?.onServerStopped) return;
    return window.movienight.onServerStopped(() => {
      if (conn?.source === "local") {
        setConn(null);
        setMovies([]);
        setModalMovie(null);
        setPlaying(null);
        notify("Local server stopped", "error");
      }
    });
  }, [conn, notify]);

  // Load libary whenever a server is connected.
  useEffect(() => {
    if (client) {
      setMovies([]);
      setQuery("");
      setFavoritesOnly(false);
      loadMovies(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  const connectLocal = async () => {
    setBusy(true);
    setError(null);
    try {
      const dir = await window.movienight.selectFolder();
      if (!dir) return;
      const result = await window.movienight.startLocalServer(dir);
      setConn({ baseUrl: result.baseUrl, source: "local", movieDir: result.movieDir });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const connectRemote = async (urlText) => {
    setBusy(true);
    setError(null);
    let url;
    try {
      url = new URL(urlText.trim());
      if (!/^https?:$/.test(url.protocol)) throw new Error("Use http:// or https://");
    } catch (err) {
      setError("Invalid server URL — use http://host:port");
      setBusy(false);
      return;
    }
    try {
      const probe = api(url.origin);
      const status = await probe.status();
      if (!status.ok) throw new Error("Server did not report OK");
      setConn({ baseUrl: url.origin, source: "remote", movieDir: status.movieDir });
    } catch (err) {
      setError(`Could not reach server at ${url.origin}: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (conn?.source === "local" && window.movienight?.stopLocalServer) {
      try {
        await window.movienight.stopLocalServer();
      } catch {
        /* ignore */
      }
    }
    setConn(null);
    setMovies([]);
    setModalMovie(null);
    setPlaying(null);
  };

  const toggleFavorite = async (movie) => {
    if (!client) return;
    const next = !movie.favorite;
    const revert = (m) => {
      setMovies((list) => list.map((x) => (x.id === m.id ? { ...x, favorite: !next } : x)));
      setModalMovie((cur) => (cur?.id === m.id ? { ...cur, favorite: !next } : cur));
    };
    setMovies((list) => list.map((x) => (x.id === movie.id ? { ...x, favorite: next } : x)));
    setModalMovie((cur) => (cur?.id === movie.id ? { ...cur, favorite: next } : cur));
    try {
      await client.setFavorite(movie.id, next);
    } catch (err) {
      revert(movie);
      notify(err.message, "error");
    }
  };

  const askForMeta = (movie) => {
    setConfirm({
      title: "Get movie information",
      body: (
        <>
          <p>
            This will search TheMovieDB for <strong>{movie.title}</strong> and, if matched, write a
            poster and metadata file (<code>poster.jpg</code> / <code>info.json</code>) next to:
          </p>
          <p className="mono">
            {conn?.source === "local" ? `${conn.movieDir}/` : ""}
            {movie.path}
          </p>
          <p>Nothing is written unless you confirm. Allow this download?</p>
        </>
      ),
      confirmLabel: "Yes, download & write",
      cancelLabel: "No, keep missing",
      onConfirm: async () => {
        try {
          const res = await client.fetchMeta(movie.id);
          setConfirm(null);
          setMovies((list) =>
            list.map((x) => (x.id === movie.id ? { ...x, ...res.movie, hasInfo: true, hasPoster: res.movie.hasPoster } : x))
          );
          if (modalMovie?.id === movie.id) setModalMovie(res.movie);
          notify(
            res.movie.hasPoster ? "Movie information saved" : "Information saved (poster unavailable)",
            "ok"
          );
        } catch (err) {
          setConfirm(null);
          notify(err.message, "error");
        }
      },
      onCancel: () => {
        setConfirm(null);
        notify("Info left missing — you can try again anytime", "muted");
      },
    });
  };

  const openModal = (movie) => setModalMovie(movie);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = movies;
    if (q) list = list.filter((m) => m.title.toLowerCase().includes(q));
    return list;
  }, [movies, query]);

  const favorites = useMemo(() => movies.filter((m) => m.favorite), [movies]);

  if (!conn || !client) {
    return <ConnectScreen busy={busy} error={error} onLocal={connectLocal} onRemote={connectRemote} />;
  }

  return (
    <div className="app">
      <TopBar
        conn={conn}
        query={query}
        onQuery={setQuery}
        favoritesOnly={favoritesOnly}
        favoriteCount={favorites.length}
        onToggleFavorites={(next) => {
          if (next === favoritesOnly) return;
          setFavoritesOnly(next);
          loadMovies(next);
        }}
        onDisconnect={disconnect}
      />
      <main className="content">
        {error && (
          <div className="error-banner">
            {error}
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {!loading && movies.length === 0 && (
          <div className="empty">
            <h2>No movies here yet</h2>
            <p>Put video files (.mp4, .mkv, .mov, …) in the scanned folder to get started.</p>
          </div>
        )}

        {!favoritesOnly && favorites.length > 0 && (
          <section>
            <h2 className="row-title">
              My Favorites <span className="count-badge">{favorites.length}</span>
            </h2>
            <div className="row">
              {favorites.map((m) => (
                <MovieCard key={m.id} movie={m} client={client} onOpen={openModal} onGetInfo={askForMeta} onToggleFavorite={toggleFavorite} />
              ))}
            </div>
          </section>
        )}

        <section className="library-section">
          <h2 className="row-title">
            {favoritesOnly ? "Favorites" : query.trim() ? `Results for “${query}”` : "Browse"}
            <span className="count-badge">{filtered.length}</span>
          </h2>
          {filtered.length === 0 && !loading ? (
            <p className="dim">Nothing matches.</p>
          ) : (
            <div className="grid">
              {filtered.map((m) => (
                <MovieCard key={m.id} movie={m} client={client} onOpen={openModal} onGetInfo={askForMeta} onToggleFavorite={toggleFavorite} />
              ))}
            </div>
          )}
        </section>
      </main>

      {modalMovie && (
        <MovieModal
          movie={modalMovie}
          client={client}
          onClose={() => setModalMovie(null)}
          onPlay={setPlaying}
          onToggleFavorite={() => toggleFavorite(modalMovie)}
          onUpdate={setModalMovie}
          onGetInfo={askForMeta}
        />
      )}

      {playing && <Player movie={playing} client={client} onClose={() => setPlaying(null)} />}

      {confirm && <ConfirmDialog {...confirm} />}
      {toast && <Toast toast={toast} onDone={() => setToast(null)} />}
    </div>
  );
}