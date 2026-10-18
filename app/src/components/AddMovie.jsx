import { useCallback, useEffect, useRef, useState } from "react";

// Full-screen "Add to library" panel with the two ingest methods:
//   1. by file  — pick/drag a video, uploaded straight into the library folder
//   2. by disc  — detect a mounted DVD/Blu-ray and rip it to a playable file
const STAGES = {
  starting: "Preparing",
  ripping: "Ripping disc",
  optimising: "Optimising for streaming",
  finishing: "Adding to library",
  done: "Done",
};

function stageLabel(job) {
  if (job.state === "error") return "Failed";
  if (job.state === "cancelled") return "Cancelled";
  if (job.state === "done") return "Done";
  return STAGES[job.stage] || "Working";
}

export function AddMovie({ conn, client, onClose, onAdded, notify }) {
  const [tools, setTools] = useState(null);
  const [discs, setDiscs] = useState([]);
  const [scanning, setScanning] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [job, setJob] = useState(null);
  const inputRef = useRef(null);
  const notifiedRef = useRef(new Set());

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const scanDiscs = useCallback(async () => {
    if (!client) return;
    setScanning(true);
    try {
      const [t, d] = await Promise.all([client.tools(), client.discs()]);
      setTools(t);
      setDiscs(d.discs || []);
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setScanning(false);
    }
  }, [client, notify]);

  // Load tool + disc status on open, and pick up a rip that is still running.
  useEffect(() => {
    scanDiscs();
    client
      ?.rips()
      .then((res) => {
        const running = (res.jobs || []).find((r) => r.state === "running");
        if (running) setJob(running);
      })
      .catch(() => {
        /* an unfinished job is only a nicety */
      });
  }, [client, scanDiscs]);

  // Poll the active rip while it runs.
  useEffect(() => {
    if (!job || job.state !== "running") return undefined;
    const timer = setInterval(async () => {
      try {
        const { job: next } = await client.ripStatus(job.id);
        if (next) setJob(next);
      } catch (err) {
        clearInterval(timer);
        notify(err.message, "error");
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [job, client, notify]);

  // Fire the completion callbacks exactly once per job.
  useEffect(() => {
    if (!job || job.state === "running" || notifiedRef.current.has(job.id)) return;
    notifiedRef.current.add(job.id);
    if (job.state === "done") {
      notify(`Added “${job.result}” to your library`, "ok");
      onAdded();
    } else if (job.state === "error") {
      notify(job.error || "Rip failed", "error");
    } else if (job.state === "cancelled") {
      notify("Rip cancelled", "muted");
    }
  }, [job, notify, onAdded]);

  const addFile = async (file) => {
    if (!file || uploading) return;
    setUploading(true);
    setUploadPct(0);
    try {
      const res = await client.upload(file, setUploadPct);
      notify(`Added “${res.name}” to your library`, "ok");
      onAdded();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setUploading(false);
      setUploadPct(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const rip = async (disc) => {
    try {
      const { job: started } = await client.startRip({
        mount: disc.mount,
        device: disc.device,
        type: disc.type,
        label: disc.label,
      });
      setJob(started);
      if (started.state === "error") notify(started.error, "error");
    } catch (err) {
      notify(err.message, "error");
    }
  };

  const cancelRip = async () => {
    if (!job) return;
    try {
      const { job: next } = await client.cancelRip(job.id);
      if (next) setJob(next);
    } catch (err) {
      notify(err.message, "error");
    }
  };

  const folderLabel = conn?.movieDir ? conn.movieDir.split("/").pop() : conn?.baseUrl || "the library";
  const toolHint = () => {
    if (!tools) return null;
    if (!tools.makemkv && !tools.handbrake) {
      return (
        <p className="tool-hint warn">
          No ripper installed. Install <code>brew install handbrake</code> for DVDs, or MakeMKV for
          Blu-ray.
        </p>
      );
    }
    return (
      <p className="tool-hint">
        {tools.makemkv && <span className="tool-badge on">MakeMKV ready — DVD + Blu-ray</span>}
        {tools.handbrake && <span className="tool-badge on">HandBrake ready — DVD + transcoding</span>}
        {!tools.makemkv && <span className="tool-badge warn">Blu-ray needs MakeMKV</span>}
      </p>
    );
  };

  return (
    <div className="panel-view add-movie">
      <header className="panel-top">
        <button className="btn btn-ghost" onClick={onClose}>
          ← Back
        </button>
        <div className="panel-heading">
          <span className="panel-title">Add to library</span>
        </div>
        <button className="player-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>

      <div className="panel-body">
        <section className="add-section">
          <h3 className="panel-section-title">Add a file</h3>
          <p className="dim">
            Drop or pick a video file. It is copied into <code>{folderLabel}</code> and appears
            straight away.
          </p>
          <div
            className={"dropzone" + (dragging ? " over" : "")}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              addFile(e.dataTransfer.files?.[0]);
            }}
          >
            {uploading ? (
              <>
                <div className="progress">
                  <div className="progress-bar" style={{ width: `${uploadPct}%` }} />
                </div>
                <p className="dim">Uploading… {uploadPct}%</p>
              </>
            ) : (
              <>
                <p className="dropzone-text">Drag a video file here</p>
                <button className="btn btn-primary" onClick={() => inputRef.current?.click()}>
                  Choose file…
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  hidden
                  accept="video/*,.mkv,.mp4,.m4v,.mov,.avi,.webm,.ogv,.wmv,.flv,.mpg,.mpeg,.ts,.3gp"
                  onChange={(e) => addFile(e.target.files?.[0])}
                />
              </>
            )}
          </div>
        </section>

        <section className="add-section">
          <h3 className="panel-section-title">Rip a DVD or Blu-ray</h3>
          {toolHint()}
          <div className="disc-toolbar">
            <p className="dim">Insert a disc and it shows up here.</p>
            <button className="btn btn-ghost" onClick={scanDiscs} disabled={scanning}>
              {scanning ? "Scanning…" : "Rescan"}
            </button>
          </div>

          {discs.length === 0 ? (
            <p className="dim">No disc detected.</p>
          ) : (
            <ul className="disc-list">
              {discs.map((d) => (
                <li key={d.mount} className="disc-row">
                  <span className={"disc-type " + d.type}>{d.type === "bluray" ? "Blu-ray" : "DVD"}</span>
                  <span className="disc-label">{d.label}</span>
                  <button
                    className="btn btn-primary"
                    disabled={Boolean(job)}
                    onClick={() => rip(d)}
                    title={job ? "A rip is already in progress" : undefined}
                  >
                    Rip &amp; add
                  </button>
                </li>
              ))}
            </ul>
          )}

          {job && (
            <div className="rip-progress">
              <div className="progress">
                <div className="progress-bar" style={{ width: `${job.progress || 0}%` }} />
              </div>
              <div className="rip-status">
                <span>
                  {stageLabel(job)} · {job.progress || 0}%
                  {job.state === "done" && job.result ? ` — ${job.result}` : ""}
                  {job.state === "error" ? ` — ${job.error}` : ""}
                </span>
                {job.state === "running" && (
                  <button className="btn btn-ghost" onClick={cancelRip}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
