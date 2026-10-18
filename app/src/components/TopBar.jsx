import { UserMenu } from "./UserMenu.jsx";

export function TopBar({ conn, query, onQuery, onDisconnect, onNavigate, onOpenAdd }) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="logo">
          movie<span>night</span>
        </div>
      </div>

      <div className="topbar-right">
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
        <UserMenu conn={conn} onDisconnect={onDisconnect} onNavigate={onNavigate} />
      </div>
    </header>
  );
}
