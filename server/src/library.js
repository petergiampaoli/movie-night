const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const VIDEO_EXTS = [
  ".mp4", ".m4v", ".mkv", ".mov", ".avi", ".webm", ".ogv",
  ".wmv", ".flv", ".mpg", ".mpeg", ".ts", ".3gp",
];

const POSTER_NAMES = ["poster.jpg", "poster.jpeg", "poster.png", "poster.webp"];
const INFO_NAME = "info.json";
const FAVORITES_NAME = "favorites.json";
const POSTERS_DIR = "posters";

function idFor(relPath) {
  return crypto.createHash("sha1").update(relPath).digest("base64url");
}

function guessYear(name) {
  const m = name.match(/(?:19|20)\d{2}/);
  return m ? parseInt(m[0], 10) : null;
}

function cleanTitle(name) {
  let out = name.replace(/\.[A-Za-z0-9]{2,5}$/, "");
  out = out.replace(/\[[^\]]*\]/g, " ").replace(/\([^)]*\)/g, " ");
  out = out.replace(/[._+]/g, " ");
  out = out.replace(
    /\b\d{3,4}p\b|\b(bluray|brrip|webdl|webrip|hdtv|hdrip|x264|x265|h\.?264|h\.?265|hevc|aac|dts|dd5\.[01]|stereo|remux)\b/gi,
    " "
  );
  out = out.replace(/\s+/g, " ").trim();
  return out || name;
}

// Heuristic: a file is an "episode" if its name carries an SxxEyy marker.
const EPISODE_RE = /(?:^|[\s._-])(?:s\d{1,2}\s?e\d{1,3}|e\d{1,3})(?:$|[\s._-])/i;

// Series grouping pass: folders holding 2+ video files are treated as shows
// (their files are episodes), single-video folders are standalone films.
function classifyGroups(walked) {
  const byDir = new Map();
  for (const rec of walked) {
    const group = byDir.get(rec.dir) || (byDir.set(rec.dir, []), byDir.get(rec.dir));
    group.push(rec);
  }
  for (const rec of walked) {
    const siblings = byDir.get(rec.dir) || [rec];
    const hasEpisodeMarker = EPISODE_RE.test(rec.basename);
    rec.kind = hasEpisodeMarker || siblings.length > 1 ? "series" : "film";
  }
  return walked;
}

function walk(dirs, base = "") {
  const raw = [];
  let entries;
  try {
    entries = fs.readdirSync(dirs, { withFileTypes: true });
  } catch {
    return raw;
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue; // skip hidden dirs incl. .movienight
    const rel = base ? path.join(base, entry.name) : entry.name;
    const full = path.join(dirs, entry.name);
    if (entry.isDirectory()) raw.push(...walk(full, rel));
    else if (entry.isFile() && VIDEO_EXTS.includes(path.extname(entry.name).toLowerCase())) {
      let addedAt = null;
      try {
        const st = fs.statSync(full);
        addedAt = (st.birthtimeMs || st.mtimeMs) || null;
      } catch {
        /* stat may fail for unreadable files */
      }
      raw.push({
        srcPath: full,
        relPath: rel,
        id: idFor(rel),
        basename: entry.name,
        cleanTitle: cleanTitle(entry.name),
        yearGuess: guessYear(entry.name),
        dir: path.dirname(full),
        ext: path.extname(entry.name).toLowerCase(),
        addedAt,
      });
    }
  }
  return classifyGroups(raw);
}

class Library {
  constructor({ movieDir, dataDir }) {
    this.movieDir = movieDir;
    this.dataDir = dataDir;
    this._cache = { key: null, recs: null };
  }

  _signature() {
    let stat;
    try {
      stat = fs.statSync(this.movieDir);
    } catch {
      return "missing";
    }
    return `${stat.mtimeMs}`;
  }

  invalidate() {
    this._cache = { key: null, recs: null };
  }

  scan() {
    if (this._cache.recs && this._cache.key === this._signature()) return this._cache.recs;
    const recs = walk(this.movieDir);
    this._cache = { key: this._signature(), recs };
    return recs;
  }

  list() {
    return this.scan();
  }

  find(id) {
    return this.scan().find((r) => r.id === id) || null;
  }

  infoPath(rec) {
    return path.join(rec.dir, INFO_NAME);
  }

  readInfo(rec) {
    try {
      const data = JSON.parse(fs.readFileSync(this.infoPath(rec), "utf8"));
      return data && typeof data === "object" ? data : null;
    } catch {
      return null;
    }
  }

  posterPath(rec) {
    for (const name of POSTER_NAMES) {
      const p = path.join(rec.dir, name);
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  dataPosterPath(id) {
    return path.join(this.dataDir, POSTERS_DIR, `${id}.jpg`);
  }
}

module.exports = {
  Library,
  VIDEO_EXTS,
  POSTER_NAMES,
  INFO_NAME,
  FAVORITES_NAME,
  POSTERS_DIR,
  idFor,
  guessYear,
  cleanTitle,
};