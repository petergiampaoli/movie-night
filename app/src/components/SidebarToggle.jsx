export function SidebarToggle({ open, onToggle }) {
  return (
    <button
      className={"sidebar-toggle" + (open ? " open" : "")}
      onClick={onToggle}
      aria-label={open ? "Close menu" : "Open menu"}
      aria-expanded={open}
      aria-controls="app-sidebar"
    >
      {open ? (
        <span className="chev" aria-hidden="true">
          ‹
        </span>
      ) : (
        <>
          <span className="bar" />
          <span className="bar" />
          <span className="bar" />
        </>
      )}
    </button>
  );
}
