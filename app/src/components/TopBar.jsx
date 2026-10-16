export function TopBar({ conn, query, onQuery, onDisconnect }) {
  const displayDir = conn.movieDir ? conn.movieDir.split("/").pop() : conn.baseUrl || "";
  const label = conn.source === "local" ? "Folder · " + displayDir : "Server · " + conn.baseUrl;

  return (
    <header className="topbar">
      <div className="brand-block">
        <div className="logo">
          movie<span>night</span>
        </div>
      </div>

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
