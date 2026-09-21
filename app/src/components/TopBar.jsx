export function TopBar({
  conn,
  query,
  onQuery,
  favoritesOnly,
  favoriteCount,
  onToggleFavorites,
  onDisconnect,
}) {
  const displayDir =
    conn.source === "local" ? (conn.movieDir || "local folder").split("/").pop() : conn.baseUrl.replace(/^https?:\/\//, "");
  const label = conn.source === "local" ? `Folder · ${displayDir}` : `Server · ${conn.baseUrl}`;

  return (
    <header className="topbar">
      <div className="logo">local<span>flix</span></div>

      <nav className="nav">
        <button className={!favoritesOnly ? "nav-btn active" : "nav-btn"} onClick={() => onToggleFavorites(false)}>
          Browse
        </button>
        <button className={favoritesOnly ? "nav-btn active" : "nav-btn"} onClick={() => onToggleFavorites(true)}>
          Favorites{favoriteCount > 0 ? ` (${favoriteCount})` : ""}
        </button>
      </nav>

      <div className="search">
        <span className="search-icon">⌕</span>
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search…"
          spellCheck={false}
        />
        {query && (
          <button className="clear" onClick={() => onQuery("")} title="Clear search">
            ✕
          </button>
        )}
      </div>

      <div className="topbar-right">
        <span className="server-chip" title={label}>
          {conn.source === "local" ? "📁" : "🖧"} {displayDir}
        </span>
        <button className="btn btn-ghost" onClick={onDisconnect}>
          Disconnect
        </button>
      </div>
    </header>
  );
}