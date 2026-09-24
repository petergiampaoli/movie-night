import { useEffect, useRef, useState } from "react";

const VIEWS = [
  { id: "films", icon: "🎬", label: "Films" },
  { id: "series", icon: "📺", label: "Series" },
  { id: "favorites", icon: "♥", label: "Favorites" },
  { id: "new", icon: "✨", label: "Newly Added" },
];

export function TopBar({
  conn,
  query,
  onQuery,
  view,
  favoriteCount,
  onSelectView,
  onDisconnect,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  // Close the dropdown when clicking outside or pressing Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const displayDir = conn.movieDir ? conn.movieDir.split("/").pop() : conn.baseUrl || "";
  const label = conn.source === "local" ? "Folder · " + displayDir : "Server · " + conn.baseUrl;

  // active view label next to the hamburger (match "Films" naming used by views)
  const active = VIEWS.find((v) => v.id === view) || VIEWS[0];

  return (
    <header className="topbar">
      <div className="brand-block">
        <div className="menu-wrap" ref={rootRef}>
          <button
            className={"hamburger" + (open ? " open" : "")}
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={open}
          >
            <span className="bar" />
            <span className="bar" />
            <span className="bar" />
          </button>

          {open && (
            <div className="hamburger-menu">
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  className={"menu-item" + (view === v.id ? " active" : "")}
                  onClick={() => {
                    onSelectView(v.id);
                    setOpen(false);
                  }}
                >
                  <span className="menu-icon">{v.icon}</span>
                  <span className="menu-label">{v.label}</span>
                  {v.id === "favorites" && favoriteCount > 0 && (
                    <span className="menu-count">{favoriteCount}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
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
