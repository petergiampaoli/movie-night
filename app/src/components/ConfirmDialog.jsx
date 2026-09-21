import { useEffect } from "react";

export function ConfirmDialog({ state, onCancel, onConfirm }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="modal-backdrop">
      <div className="dialog" role="alertdialog" aria-modal="true">
        <h2>{state.title}</h2>
        <div className="dialog-body">{typeof state.body === "string" ? <p>{state.body}</p> : state.body}</div>
        <div className="dialog-actions">
          {state.extra && state.extra({ onCancel, onConfirm })}
          <button className="btn btn-ghost" onClick={onCancel} autoFocus>
            {state.cancelLabel || "Cancel"}
          </button>
          <button className={`btn ${state.danger ? "btn-danger" : "btn-primary"}`} onClick={onConfirm}>
            {state.confirmLabel || "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}