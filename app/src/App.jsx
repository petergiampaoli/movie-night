import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { filterMovies, smartCollections, smartGenres, viewCounts } from "./viewFilter.mjs";
import { ConnectScreen } from "./components/ConnectScreen.jsx";
import { TopBar } from "./components/TopBar.jsx";
import { Sidebar } from "./components/Sidebar.jsx";
import { MovieCard } from "./components/MovieCard.jsx";
import { MovieModal } from "./components/MovieModal.jsx";
import { Player } from "./components/Player.jsx";
import { ConfirmDialog } from "./components/ConfirmDialog.jsx";
import { Toast } from "./components/Toast.jsx";

const DEFAULT_SELECTION = { type: "view", value: "films" };

function selectionTitle(selection, query) {
  if (query.trim()) return `Results for “${query}”`;
  if (!selection) return "Browse";
  if (selection.type === "director") return selection.value;
  if (selection.type === "genre") return selection.value;
  const labels = { films: "Films", series: "Series", new: "New", favorites: "Favorites" };
  return labels[selection.value] || "Browse";
}

export default function App() {
  const [conn, setConn] = useState(null); // { baseUrl, source: 'local'|'remote', movieDir }
  const [busy, setBusy] = useState(false);
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState(DEFAULT_SELECTION);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [modalMovie, setModalMovie] = useState(null);
  const [playing, setPlaying] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(null);

  const client = useMemo(() => (conn ? api(conn.baseUrl) : null), [conn]);

  const notify = useCallback((msg, kind = "ok") => setToast({ msg, kind }), []);

  const loadMovies = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    try {
      const data = await client.movies(false);
      setMovies(data.movies || []);
    } catch (err) {
      setError(err.message);
      notify(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [client, notify]);

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

  // Load library whenever a server is connected.
  useEffect(() => {
    if (client) {
      setMovies([]);
      setQuery("");
      setSelection(DEFAULT_SELECTION);
      loadMovies();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  const connectLocal = async () => {
    setBusy(true);
    setError(null);
    try {
      if (window.movienight?.selectFolder) {
        // Desktop app: native folder dialog, then we start the local Node server.
        const dir = await window.movienight.selectFolder();
        if (!dir) return;
        const result = await window.movienight.startLocalServer(dir);
        setConn({ baseUrl: result.baseUrl, source: "local", movieDir: result.movieDir });
        return;
      }
      // Plain browser: there is no Electron bridge, so a local server can't be
      // started from the page. Still honour the user's intent to pick a folder,
      // then explain how to get the full experience.
      if (window.showDirectoryPicker) {
        try {
          await window.showDirectoryPicker();
        } catch {
          return; // user cancelled the folder dialog
        }
      }
      setError(
        "Folder browsing is only available in the desktop app. Run `npm start` for the app, " +
          "or start the server (`node server/src/index.js`) and use “Connect to a server”."
      );
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

  const filtered = useMemo(() => filterMovies(movies, selection, query), [movies, selection, query]);
  const collections = useMemo(() => smartCollections(movies), [movies]);
  const genres = useMemo(() => smartGenres(movies, 6), [movies]);
  const counts = useMemo(() => viewCounts(movies), [movies]);

  if (!conn || !client) {
    return <ConnectScreen busy={busy} error={error} onLocal={connectLocal} onRemote={connectRemote} />;
  }

  return (
    <div className="app">
      <TopBar
        conn={conn}
        query={query}
        onQuery={setQuery}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onDisconnect={disconnect}
      />
      <div className="app-body">
        <Sidebar
          open={sidebarOpen}
          selection={selection}
          onSelect={setSelection}
          counts={counts}
          collections={collections}
          genres={genres}
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

          {movies.length > 0 && (
            <section className="library-section">
              <h2 className="row-title">
                {selectionTitle(selection, query)}
                <span className="count-badge">{filtered.length}</span>
              </h2>
              {filtered.length === 0 && !loading ? (
                <p className="dim">Nothing matches.</p>
              ) : (
                <div className="grid">
                  {filtered.map((m) => (
                    <MovieCard
                      key={m.id}
                      movie={m}
                      client={client}
                      onOpen={openModal}
                      onGetInfo={askForMeta}
                      onToggleFavorite={toggleFavorite}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </main>
      </div>

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

      {confirm && (
        <ConfirmDialog state={confirm} onCancel={confirm.onCancel} onConfirm={confirm.onConfirm} />
      )}
      {toast && <Toast toast={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
