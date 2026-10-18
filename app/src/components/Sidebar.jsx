import { useState } from "react";

function isActive(selection, type, value) {
  return selection?.type === type && selection?.value === value;
}

function Accordion({ title, icon, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={"accordion" + (open ? " open" : "")}>
      <button
        className="accordion-head"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="nav-icon">{icon}</span>
        <span className="nav-label">{title}</span>
        <span className="accordion-caret">▶</span>
      </button>
      {open && <div className="accordion-panel">{children}</div>}
    </div>
  );
}

export function Sidebar({ open, selection, onSelect, counts, collections, genres, onOpenAdd }) {
  const pick = (next) => onSelect(next);

  return (
    <aside id="app-sidebar" className={"sidebar" + (open ? " open" : "")} aria-hidden={!open}>
      <div className="sidebar-inner">
        <button
          className="nav-item sidebar-add-media"
          type="button"
          onClick={() => onOpenAdd?.()}
        >
          <span className="nav-icon sidebar-add-icon">+</span>
          <span className="nav-label">Add media</span>
        </button>
        <div className="sidebar-heading">Library</div>
        <button
          className={"nav-item" + (isActive(selection, "view", "films") ? " active" : "")}
          onClick={() => pick({ type: "view", value: "films" })}
        >
          <span className="nav-icon">🎬</span>
          <span className="nav-label">Films</span>
          <span className="nav-count">{counts.films}</span>
        </button>
        <button
          className={"nav-item" + (isActive(selection, "view", "series") ? " active" : "")}
          onClick={() => pick({ type: "view", value: "series" })}
        >
          <span className="nav-icon">📺</span>
          <span className="nav-label">Series</span>
          <span className="nav-count">{counts.series}</span>
        </button>

        <button
          className={"nav-item" + (isActive(selection, "view", "new") ? " active" : "")}
          onClick={() => pick({ type: "view", value: "new" })}
        >
          <span className="nav-icon">✨</span>
          <span className="nav-label">New</span>
        </button>
        <button
          className={"nav-item" + (isActive(selection, "view", "favorites") ? " active" : "")}
          onClick={() => pick({ type: "view", value: "favorites" })}
        >
          <span className="nav-icon">♥</span>
          <span className="nav-label">Favorites</span>
          {counts.favorites > 0 && <span className="nav-count">{counts.favorites}</span>}
        </button>
        <button
          className={"nav-item" + (isActive(selection, "view", "watchlist") ? " active" : "")}
          onClick={() => pick({ type: "view", value: "watchlist" })}
        >
          <span className="nav-icon">🔖</span>
          <span className="nav-label">Watchlist</span>
          {counts.watchlist > 0 && <span className="nav-count">{counts.watchlist}</span>}
        </button>

        <Accordion title="Smart Collections" icon="🗂" defaultOpen>
          {collections.length === 0 && <p className="sidebar-empty">No director data yet.</p>}
          {collections.map((c) => (
            <button
              key={c.id}
              className={"sidebar-sub" + (isActive(selection, "director", c.label) ? " active" : "")}
              onClick={() => pick({ type: "director", value: c.label })}
            >
              <span className="nav-label">{c.label}</span>
              <span className="nav-count">{c.count}</span>
            </button>
          ))}
        </Accordion>

        <Accordion title="Smart Genres" icon="🏷" defaultOpen>
          {genres.length === 0 && <p className="sidebar-empty">No genre data yet.</p>}
          {genres.map((g) => (
            <button
              key={g.id}
              className={"sidebar-sub" + (isActive(selection, "genre", g.label) ? " active" : "")}
              onClick={() => pick({ type: "genre", value: g.label })}
            >
              <span className="nav-label">{g.label}</span>
              <span className="nav-count">{g.count}</span>
            </button>
          ))}
        </Accordion>
      </div>
    </aside>
  );
}
