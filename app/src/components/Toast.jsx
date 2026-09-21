import { useEffect, useState } from "react";

export function Toast({ toast, onDone }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const hide = setTimeout(() => setLeaving(true), 2600);
    return () => clearTimeout(hide);
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(onDone, 300);
    return () => clearTimeout(t);
  }, [leaving, onDone]);

  return <div className={`toast toast-${toast.kind || "ok"} ${leaving ? "leave" : ""}`}>{toast.msg}</div>;
}