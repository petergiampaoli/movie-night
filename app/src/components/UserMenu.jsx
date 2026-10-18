import { useEffect, useRef, useState } from "react";

// Letterboxd-style account flyout: click the avatar in the top bar to open a
// panel of account shortcuts (with "Disconnect from server" where "Sign Out"
// would be). Every entry is wired to a real destination in Movie Night:
//   action "view"  -> narrow the grid (Films, Diary, Watchlist, Likes)
//   action "panel" -> open a full-screen panel (Profile, Reviews, Lists, Tags, Settings)
const ACCOUNT_ITEMS = [
  { label: "Profile", action: "panel", value: "profile" },
  { label: "Films", action: "view", value: "films" },
  { label: "Diary", action: "view", value: "diary" },
  { label: "Reviews", action: "panel", value: "reviews" },
  { label: "Watchlist", action: "view", value: "watchlist" },
  { label: "Lists", action: "panel", value: "lists" },
  { label: "Likes", action: "view", value: "likes" },
  { label: "Tags", action: "panel", value: "tags" },
  { label: "Settings", action: "panel", value: "settings" },
];

export function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-3.9 0-7 2.2-7 5v1.5c0 .3.2.5.5.5h13c.3 0 .5-.2.5-.5V19c0-2.8-3.1-5-7-5Z"
      />
    </svg>
  );
}

// Derive a human-readable name/subtitle for the connected library. Shared with
// the Profile/Settings panels so every surface labels the connection the same.
export function libraryIdentity(conn) {
  const displayDir = conn.movieDir ? conn.movieDir.split("/").pop() : "";
  return {
    name: conn.source === "local" ? displayDir || "Local library" : conn.baseUrl,
    subtitle: conn.source === "local" ? "Local folder" : "Connected server",
  };
}

export function UserMenu({ conn, onDisconnect, onNavigate }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const { name, subtitle } = libraryIdentity(conn);
  return (
    <div className="user-menu" ref={rootRef}>
      <button
        className={"user-avatar" + (open ? " open" : "")}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
      >
        <UserIcon />
      </button>

      {open && (
        <div className="user-dropdown" role="menu">
          <div className="user-dropdown-head">
            <span className="user-avatar lg">
              <UserIcon />
            </span>
            <span className="user-dropdown-id">
              <span className="user-dropdown-name">{name}</span>
              <span className="user-dropdown-sub">{subtitle}</span>
            </span>
          </div>

          <div className="user-dropdown-list">
            {ACCOUNT_ITEMS.map((item) => (
              <button
                key={item.label}
                className="user-dropdown-item"
                role="menuitem"
                onClick={() => {
                  onNavigate?.(item);
                  setOpen(false);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="user-dropdown-foot">
            <button
              className="user-dropdown-item danger"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onDisconnect();
              }}
            >
              Disconnect from server
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
