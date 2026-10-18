const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");

// Where to look for a ripper. Order matters: MakeMKV wins when present because
// it is the only one that can decrypt a Blu-ray.
const DEFAULT_CANDIDATES = {
  makemkv: [
    process.env.MOVIENIGHT_MAKEMKV,
    "/Applications/MakeMKV.app/Contents/MacOS/makemkvcon",
    "/usr/local/bin/makemkvcon",
    "makemkvcon",
  ].filter(Boolean),
  handbrake: [
    process.env.MOVIENIGHT_HANDBRAKE,
    "/usr/local/bin/HandBrakeCLI",
    "/opt/homebrew/bin/HandBrakeCLI",
    "HandBrakeCLI",
    "handbrakecli",
  ].filter(Boolean),
};

function isExecutable(file) {
  try {
    return fs.statSync(file).isFile() && (fs.statSync(file).mode & 0o111) !== 0;
  } catch {
    return false;
  }
}

function findOnPath(bin, env = process.env) {
  for (const dir of String(env.PATH || "").split(path.delimiter)) {
    if (!dir) continue;
    const full = path.join(dir, bin);
    if (isExecutable(full)) return full;
  }
  return null;
}

// Returns the absolute path to the first working candidate, or null.
function resolveTool(candidates, env = process.env) {
  for (const c of candidates) {
    if (!c) continue;
    if (path.isAbsolute(c)) {
      if (isExecutable(c)) return c;
    } else {
      const found = findOnPath(c, env);
      if (found) return found;
    }
  }
  return null;
}

// MakeMKV reports CSV progress on stdout as PRGV:<current>,<remaining>,<total>.
function parseMakeMkvProgress(line) {
  const m = /^PRGV:(\d+),(\d+),(\d+)/.exec(String(line).trim());
  if (!m) return null;
  const [cur, remain, total] = m.slice(1).map(Number);
  const candidates = [];
  if (total > 0) candidates.push(cur / total);
  if (cur + remain > 0) candidates.push(cur / (cur + remain));
  const valid = candidates.filter((p) => p >= 0 && p <= 1);
  if (!valid.length) return null;
  return Math.round(Math.min(...valid) * 100);
}

// HandBrake writes "Encoding: task 1 of 1, 45.67% (12.3 fps, ...)" to stderr.
function parseHandBrakeProgress(line) {
  const m = /Encoding:.*?(\d+(?:\.\d+)?)%/.exec(String(line));
  return m ? Math.min(100, Math.round(Number(m[1]))) : null;
}

// Keep library filenames tidy but recognisable.
function safeName(label) {
  let out = String(label || "")
    .replace(/[/\\]/g, " ")
    .replace(/\.\.+/g, " ")
    .replace(/[^A-Za-z0-9 .\-_&'()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return out || "Disc rip";
}

// Ripper: runs the disc -> file pipeline as a background job with progress.
//
//   ripping      (disc -> MKV via MakeMKV, or DVD -> MP4 via HandBrake)
//   optimising   (optional MKV -> H.264 MP4 via HandBrake)
//   finishing    (move the result into MOVIE_DIR under a readable name)
class Ripper {
  constructor({ movieDir, tools = null, spawn: spawnFn = spawn, library = null } = {}) {
    this.movieDir = movieDir;
    this._override = tools;
    this._spawn = spawnFn;
    this.library = library;
    this.jobs = new Map();
  }

  get _tools() {
    if (this._override) return this._override;
    if (!this._resolved) {
      this._resolved = {
        makemkv: resolveTool(DEFAULT_CANDIDATES.makemkv),
        handbrake: resolveTool(DEFAULT_CANDIDATES.handbrake),
      };
    }
    return this._resolved;
  }

  tools() {
    const t = this._tools;
    return { makemkv: Boolean(t.makemkv), handbrake: Boolean(t.handbrake) };
  }

  list() {
    return [...this.jobs.values()].map((j) => this.serialize(j));
  }

  get(id) {
    const job = this.jobs.get(id);
    return job ? this.serialize(job) : null;
  }

  serialize(job) {
    return {
      id: job.id,
      state: job.state,
      stage: job.stage,
      progress: job.progress,
      label: job.label,
      type: job.type,
      optimize: job.optimize,
      result: job.result || null,
      error: job.error || null,
      message: job.message || null,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
    };
  }

  start({ mount, device, type = "dvd", label, optimize = false }) {
    const id = crypto.randomUUID();
    const job = {
      id,
      state: "running",
      stage: "starting",
      progress: 0,
      mount,
      device,
      type,
      label: label || "Disc",
      optimize: Boolean(optimize),
      startedAt: Date.now(),
      finishedAt: null,
      result: null,
      error: null,
      message: null,
      _child: null,
    };
    this.jobs.set(id, job);
    this._prune();
    this._run(job).catch((err) => {
      if (job.state !== "cancelled") {
        job.state = "error";
        job.error = err.message;
      }
      if (job.finishedAt == null) job.finishedAt = Date.now();
    });
    return this.serialize(job);
  }

  cancel(id) {
    const job = this.jobs.get(id);
    if (!job) return null;
    if (job.state !== "running") return this.serialize(job);
    job.state = "cancelled";
    try {
      job._child?.kill("SIGKILL");
    } catch {
      /* already gone */
    }
    if (job.finishedAt == null) job.finishedAt = Date.now();
    return this.serialize(job);
  }

  _prune(keep = 20) {
    const finished = [...this.jobs.values()].filter((j) => j.state !== "running");
    if (finished.length <= keep) return;
    finished
      .sort((a, b) => (a.finishedAt || 0) - (b.finishedAt || 0))
      .slice(0, finished.length - keep)
      .forEach((j) => this.jobs.delete(j.id));
  }

  async _run(job) {
    // The work dir is hidden inside the library so a half-written rip is never
    // scanned as a movie (walk() skips names starting with ".").
    const tmpRoot = path.join(this.movieDir, ".movienight", "rip", job.id);
    fs.mkdirSync(tmpRoot, { recursive: true });
    try {
      const { makemkv, handbrake } = this._tools;
      if (!makemkv && !handbrake) {
        throw new Error(
          "No ripper found. Install HandBrake for DVDs (brew install handbrake), or MakeMKV for Blu-ray."
        );
      }
      if (job.type === "bluray" && !makemkv) {
        throw new Error(
          "Blu-ray ripping needs MakeMKV (it decrypts the disc). HandBrake cannot read protected Blu-rays."
        );
      }

      job.stage = "ripping";
      let output = makemkv ? await this._makeMkv(job, tmpRoot) : await this._handBrakeDisc(job, tmpRoot);

      if (job.optimize && handbrake && path.extname(output).toLowerCase() === ".mkv") {
        job.stage = "optimising";
        const mp4 = await this._handBrakeEncode(job, output, tmpRoot);
        try {
          fs.unlinkSync(output);
        } catch {
          /* ignore */
        }
        output = mp4;
      }

      job.stage = "finishing";
      job.progress = Math.max(job.progress, 96);
      const ext = path.extname(output).toLowerCase();
      const finalName = this._uniqueName(`${safeName(job.label)}${ext}`);
      fs.renameSync(output, path.join(this.movieDir, finalName));
      this.library?.invalidate();
      job.progress = 100;
      job.stage = "done";
      job.state = "done";
      job.result = finalName;
    } catch (err) {
      if (job.state !== "cancelled") {
        job.state = "error";
        job.error = err.message;
      }
    } finally {
      try {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      } catch {
        /* best-effort */
      }
      if (job.finishedAt == null) job.finishedAt = Date.now();
    }
  }

  _runTool(job, bin, args, onLine) {
    return new Promise((resolve, reject) => {
      const child = this._spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
      job._child = child;
      const feed = (chunk) => {
        for (const line of String(chunk).split(/\r?\n/)) {
          if (line) onLine(line);
        }
      };
      if (child.stdout) child.stdout.on("data", feed);
      if (child.stderr) child.stderr.on("data", feed);
      child.once("error", (err) => {
        job._child = null;
        reject(new Error(`Could not run ${path.basename(String(bin))}: ${err.message}`));
      });
      child.once("close", (code, signal) => {
        job._child = null;
        if (job.state === "cancelled") {
          reject(Object.assign(new Error("Rip cancelled"), { cancelled: true }));
          return;
        }
        if (code !== 0) {
          const how = signal ? ` (${signal})` : ` (code ${code})`;
          reject(new Error(`${path.basename(String(bin))} failed${how}`));
          return;
        }
        resolve();
      });
    });
  }

  _applyProgress(job, pct, ceiling) {
    if (pct == null) return;
    const scaled = Math.round((pct / 100) * ceiling);
    if (scaled > job.progress) job.progress = scaled;
    job.stagePercent = pct;
  }

  async _makeMkv(job, tmpRoot) {
    if (!job.device) {
      throw new Error("Could not read the disc device node — is the disc still inserted?");
    }
    const args = ["-r", "--progress=-1", "copy", `dev:${job.device}`, tmpRoot];
    await this._runTool(job, this._tools.makemkv, args, (line) =>
      this._applyProgress(job, parseMakeMkvProgress(line), 70)
    );
    const titles = fs
      .readdirSync(tmpRoot)
      .filter((f) => path.extname(f).toLowerCase() === ".mkv");
    if (!titles.length) throw new Error("MakeMKV finished but produced no video file");
    titles.sort(
      (a, b) => fs.statSync(path.join(tmpRoot, b)).size - fs.statSync(path.join(tmpRoot, a)).size
    );
    return path.join(tmpRoot, titles[0]);
  }

  async _handBrakeDisc(job, tmpRoot) {
    const out = path.join(tmpRoot, `${safeName(job.label)}.mp4`);
    const args = ["-i", job.mount, "-o", out, "-Z", "Fast 1080p30"];
    await this._runTool(job, this._tools.handbrake, args, (line) => {
      const pct = parseHandBrakeProgress(line);
      if (pct != null) this._applyProgress(job, pct, 70);
    });
    if (!fs.existsSync(out)) throw new Error("HandBrake finished but produced no video file");
    return out;
  }

  async _handBrakeEncode(job, input, tmpRoot) {
    const out = path.join(tmpRoot, "optimised.mp4");
    const args = ["-i", input, "-o", out, "-Z", "Fast 1080p30"];
    await this._runTool(job, this._tools.handbrake, args, (line) => {
      const pct = parseHandBrakeProgress(line);
      if (pct != null) this._applyProgress(job, 70 + (pct / 100) * 25, 100);
    });
    if (!fs.existsSync(out)) throw new Error("HandBrake finished but produced no video file");
    return out;
  }

  _uniqueName(name) {
    if (!fs.existsSync(path.join(this.movieDir, name))) return name;
    const ext = path.extname(name);
    const base = name.slice(0, name.length - ext.length);
    let i = 2;
    while (fs.existsSync(path.join(this.movieDir, `${base} (${i})${ext}`))) i += 1;
    return `${base} (${i})${ext}`;
  }
}

module.exports = {
  Ripper,
  resolveTool,
  parseMakeMkvProgress,
  parseHandBrakeProgress,
  safeName,
  DEFAULT_CANDIDATES,
};
