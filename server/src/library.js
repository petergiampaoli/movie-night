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
const EPISODE_SE = /s(\d{1,2})\s?e(\d{1,3})/i;
const EPISODE_E = /(?:^|[\s._-])e(\d{1,3})(?:$|[\s._-])/i;

function parseEpisode(name) {
  let m = name.match(EPISODE_SE);
  if (m) return { season: Number(m[1]), episode: Number(m[2]) };
  m = name.match(EPISODE_E);
  if (m) return { season: 1, episode: Number(m[1]) };
  return null;
}

// Best-effort episode title from a filename: anything after the SxxEyy marker,
// else the cleaned name, else "Episode N".
function episodeTitle(name, ep) {
  const base = name.replace(/\.[A-Za-z0-9]{2,5}$/, "");
  const m = base.match(EPISODE_SE);
  let rest = m ? base.slice(m.index + m[0].length) : "";
  rest = rest.replace(/^[\s._-]+/, "").replace(/[-_.]+/g, " ").replace(/\s+/g, " ").trim();
  return rest || `Episode ${ep.episode}`;
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
      const ep = parseEpisode(entry.name);
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
        isEpisode: Boolean(ep),
        season: ep ? ep.season : null,
        episode: ep ? ep.episode : null,
        episodeTitle: ep ? episodeTitle(entry.name, ep) : null,
      });
    }
  }
  return raw;
}

// Grouping pass: a folder is a SERIES when it holds 2+ videos or any file with
// an SxxEyy marker; it collapses to ONE library item whose `episodes` list every
// file. Everything else stays a standalone film.
function groupItems(files) {
  const byDir = new Map();
  for (const f of files) {
    const arr = byDir.get(f.dir) || (byDir.set(f.dir, []), byDir.get(f.dir));
    arr.push(f);
  }
  const items = [];
  for (const [dir, group] of byDir) {
    const isSeries = group.length > 1 || group.some((f) => f.isEpisode);
    if (!isSeries) {
      items.push({ ...group[0], kind: "film" });
      continue;
    }
    group.sort(
      (a, b) => (a.season || 0) - (b.season || 0) || (a.episode || 0) - (b.episode || 0) || a.basename.localeCompare(b.basename)
    );
    const dirName = path.basename(dir);
    let dirRel = path.dirname(group[0].relPath);
    if (dirRel === ".") dirRel = "";
    // Multi-video folders are named by the folder; a lone episode file carries
    // the show name, so fall back to the filename with the SxxEyy marker cut.
    const seriesTitle =
      group.length === 1
        ? cleanTitle(
            group[0].basename
              .replace(/\.[A-Za-z0-9]{2,5}$/, "")
              .replace(EPISODE_SE, " ")
              .replace(/[-_.]+/g, " ")
              .trim()
          )
        : cleanTitle(dirName);
    items.push({
      id: idFor(`series:${dirRel || dirName}`),
      relPath: dirRel || dirName,
      dir,
      basename: dirName,
      cleanTitle: seriesTitle || cleanTitle(dirName),
      yearGuess: guessYear(dirName),
      kind: "series",
      addedAt: group.reduce((max, f) => Math.max(max, f.addedAt || 0), 0) || null,
      episodes: group.map((f) => ({
        id: f.id,
        relPath: f.relPath,
        basename: f.basename,
        srcPath: f.srcPath,
        ext: f.ext,
        season: f.season,
        episode: f.episode,
        addedAt: f.addedAt,
        title: f.episodeTitle,
      })),
    });
  }
  return items;
}

class Library {
  constructor({ movieDir, dataDir }) {
    this.movieDir = movieDir;
    this.dataDir = dataDir;
    this._cache = { key: null, files: null, items: null, byId: null };
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
    this._cache = { key: null, files: null, items: null, byId: null };
  }

  _scanAll() {
    if (this._cache.items && this._cache.key === this._signature()) return this._cache;
    const files = walk(this.movieDir);
    const items = groupItems(files);
    // Index everything a client can address: library items (films, series
    // groups) AND individual files (so episodes/films stream by their own id).
    const byId = new Map();
    for (const f of files) byId.set(f.id, f);
    for (const it of items) byId.set(it.id, it);
    this._cache = { key: this._signature(), files, items, byId };
    return this._cache;
  }

  // Library items: films + one item per series.
  scan() {
    return this._scanAll().items;
  }

  list() {
    return this.scan();
  }

  // Raw video files (episodes + films), for streaming.
  files() {
    return this._scanAll().files;
  }

  find(id) {
    return this._scanAll().byId.get(id) || null;
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