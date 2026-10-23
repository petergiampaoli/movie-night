const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const express = require("express");
const cors = require("cors");

const { loadConfig } = require("./config");
const { Library, POSTERS_DIR, VIDEO_EXTS } = require("./library");
const { streamVideo } = require("./stream");
const { Favorites } = require("./favorites");
const { Watchlist } = require("./watchlist");
const { Ripper } = require("./ripping");
const { detectDiscs } = require("./discs");
const { Tmdb } = require("./tmdb");
const { writeInfo, writePoster } = require("./metadata");
const pkg = require("../package.json");

function createApp({
  movieDir,
  dataDir,
  apiKey,
  library,
  favorites,
  watchlist,
  ripper,
  tmdb,
  name = "movienight",
} = {}) {
  const cfg = loadConfig();
  const lib =
    library ||
    new Library({
      movieDir: movieDir || cfg.movieDir,
      dataDir: dataDir || cfg.dataDir,
    });
  const favs = favorites || new Favorites(path.join(cfg.dataDir, "favorites.json"));
  const watch = watchlist || new Watchlist(path.join(cfg.dataDir, "watchlist.json"));
  const rips = ripper || new Ripper({ movieDir: lib.movieDir, library: lib });
  const tmd = tmdb || new Tmdb(apiKey !== undefined ? apiKey : cfg.apiKey);

  // Land an uploaded file in the library without clobbering an existing one.
  function uniqueName(name) {
    if (!fs.existsSync(path.join(lib.movieDir, name))) return name;
    const ext = path.extname(name);
    const base = name.slice(0, name.length - ext.length);
    let i = 2;
    while (fs.existsSync(path.join(lib.movieDir, `${base} (${i})${ext}`))) i += 1;
    return `${base} (${i})${ext}`;
  }

  function safeImportName(name) {
    const raw = String(name || "").trim();
    if (!raw) throw new Error("Missing file name — use ?name=");
    if (/[\\/]/.test(raw)) throw new Error("File name must not contain a path");
    if (raw.startsWith(".")) throw new Error("Hidden files are not allowed");
    const ext = path.extname(raw).toLowerCase();
    if (!VIDEO_EXTS.includes(ext)) {
      throw new Error(`Unsupported file type "${ext || "none"}" — video files only`);
    }
    if (raw.length > 200) throw new Error("File name is too long");
    return raw;
  }

  function buildMovie(rec) {
    const info = lib.readInfo(rec);
    const poster = lib.posterPath(rec) || (fs.existsSync(lib.dataPosterPath(rec.id)) ? lib.dataPosterPath(rec.id) : null);
    const base = {
      id: rec.id,
      path: rec.relPath,
      title: (info && info.title) || rec.cleanTitle,
      year: (info && info.year) || rec.yearGuess,
      tagline: (info && info.tagline) || null,
      overview: (info && info.overview) || null,
      rating: (info && info.rating) || null,
      voteCount: (info && info.voteCount) || null,
      genres: (info && info.genres) || [],
      runtime: (info && info.runtime) || null,
      directors: (info && info.directors) || [],
      cast: (info && info.cast) || [],
      studios: (info && info.studios) || [],
      tmdbId: (info && info.tmdbId) || null,
      imdbId: (info && info.imdbId) || null,
      source: (info && info.source) || null,
      fetchedAt: (info && info.fetchedAt) || null,
      kind: rec.kind || "film",
      addedAt: rec.addedAt || null,
      hasInfo: Boolean(info),
      hasPoster: Boolean(poster),
      favorite: favs.has(rec.id),
      watchlist: watch.has(rec.id),
      posterUrl: poster ? `/api/movies/${rec.id}/poster` : null,
    };

    if (rec.kind === "series") {
      const meta = new Map(
        ((info && info.episodes) || []).map((e) => [`${e.season}:${e.episode}`, e])
      );
      const episodes = (rec.episodes || []).map((e) => {
        const m = meta.get(`${e.season}:${e.episode}`) || {};
        return {
          id: e.id,
          season: e.season,
          episode: e.episode,
          title: m.title || e.title || `Episode ${e.episode}`,
          overview: m.overview || null,
          airDate: m.airDate || null,
          addedAt: e.addedAt || null,
          streamUrl: `/api/movies/${e.id}/stream`,
        };
      });
      return { ...base, streamUrl: null, episodes };
    }

    return { ...base, streamUrl: `/api/movies/${rec.id}/stream` };
  }

  function findRec(req, res) {
    const rec = lib.find(req.params.id);
    if (!rec) res.status(404).json({ error: "Movie not found" });
    return rec;
  }

  // --- routes -------------------------------------------------------------

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/status", (req, res) => {
    res.json({
      ok: true,
      name,
      version: pkg.version,
      movieDir: lib.movieDir,
      movieCount: lib.list().length,
      tmdbConfigured: tmd.configured,
    });
  });

  app.get("/api/movies", (req, res) => {
    const favoritesOnly = req.query.favorites === "1" || req.query.favorites === "true";
    const watchlistOnly = req.query.watchlist === "1" || req.query.watchlist === "true";
    const kind = req.query.kind === "series" || req.query.kind === "film" ? req.query.kind : null;
    let recs = lib.list();
    if (favoritesOnly) recs = recs.filter((r) => favs.has(r.id));
    if (watchlistOnly) recs = recs.filter((r) => watch.has(r.id));
    if (kind) recs = recs.filter((r) => (r.kind || "film") === kind);
    let movies = recs.map(buildMovie);
    if (req.query.sort === "added") movies.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    else movies.sort((a, b) => a.title.localeCompare(b.title));
    res.json({ movies, count: movies.length });
  });

  app.get("/api/movies/:id", (req, res) => {
    const rec = findRec(req, res);
    if (!rec) return;
    res.json({ movie: buildMovie(rec) });
  });

  app.get("/api/movies/:id/poster", (req, res) => {
    const rec = findRec(req, res);
    if (!rec) return;
    const poster = lib.posterPath(rec) || (fs.existsSync(lib.dataPosterPath(rec.id)) ? lib.dataPosterPath(rec.id) : null);
    if (!poster) {
      res.status(404).json({ error: "No poster available" });
      return;
    }
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.sendFile(path.resolve(poster));
  });

  app.get("/api/movies/:id/stream", (req, res) => {
    const rec = findRec(req, res);
    if (!rec) return;
    if (!rec.srcPath) {
      res.status(404).json({ error: "This item has no playable file (series are played per-episode)" });
      return;
    }
    streamVideo(req, res, rec.srcPath);
  });

  app.post("/api/movies/:id/favorite", (req, res) => {
    const rec = findRec(req, res);
    if (!rec) return;
    const favorite = Boolean(req.body && req.body.favorite);
    favs.set(rec.id, favorite);
    res.json({ ok: true, id: rec.id, favorite });
  });

  app.delete("/api/movies/:id/favorite", (req, res) => {
    const rec = findRec(req, res);
    if (!rec) return;
    favs.set(rec.id, false);
    res.json({ ok: true, id: rec.id, favorite: false });
  });

  app.post("/api/movies/:id/watchlist", (req, res) => {
    const rec = findRec(req, res);
    if (!rec) return;
    const on = Boolean(req.body && req.body.watchlist);
    watch.set(rec.id, on);
    res.json({ ok: true, id: rec.id, watchlist: on });
  });

  app.delete("/api/movies/:id/watchlist", (req, res) => {
    const rec = findRec(req, res);
    if (!rec) return;
    watch.set(rec.id, false);
    res.json({ ok: true, id: rec.id, watchlist: false });
  });

  // --- add to library --------------------------------------------------------

  // "Add by file": stream the request body straight into the library folder.
  // The body is streamed, so multi-GB files never sit in memory. A half-written
  // upload uses a non-video ".part" extension, which the scanner ignores.
  app.post("/api/import", (req, res) => {
    let name;
    try {
      name = safeImportName(req.query.name);
    } catch (err) {
      res.status(400).json({ error: err.message });
      return;
    }

    const tmp = path.join(lib.movieDir, `.import-${crypto.randomBytes(8).toString("hex")}.part`);
    const out = fs.createWriteStream(tmp);
    req.on("error", () => out.destroy());
    out.on("error", () => {
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* ignore */
      }
      if (!res.headersSent) res.status(500).json({ error: "Upload failed" });
    });
    req.pipe(out);
    out.on("finish", () => {
      try {
        const final = uniqueName(name);
        fs.renameSync(tmp, path.join(lib.movieDir, final));
        lib.invalidate();
        res.json({ ok: true, name: final });
      } catch (err) {
        try {
          fs.unlinkSync(tmp);
        } catch {
          /* ignore */
        }
        res.status(500).json({ error: `Import failed: ${err.message}` });
      }
    });
  });

  // Which ripper tools the host has available (drives the in-app hint).
  app.get("/api/tools", (req, res) => res.json(rips.tools()));

  // Optical discs currently mounted under /Volumes.
  app.get("/api/discs", async (req, res) => {
    try {
      const discs = await detectDiscs();
      res.json({ discs });
    } catch (err) {
      res.status(500).json({ error: `Disc scan failed: ${err.message}` });
    }
  });

  app.get("/api/rips", (req, res) => res.json({ jobs: rips.list() }));

  app.post("/api/rips", (req, res) => {
    const body = req.body || {};
    if (!body.mount && !body.device) {
      res.status(400).json({ error: "Choose a disc to rip" });
      return;
    }
    const job = rips.start({
      mount: body.mount,
      device: body.device,
      type: body.type,
      label: body.label,
      optimize: body.optimize,
    });
    res.json({ job });
  });

  app.get("/api/rips/:id", (req, res) => {
    const job = rips.get(req.params.id);
    if (!job) return res.status(404).json({ error: "Rip not found" });
    res.json({ job });
  });

  app.delete("/api/rips/:id", (req, res) => {
    const job = rips.cancel(req.params.id);
    if (!job) return res.status(404).json({ error: "Rip not found" });
    res.json({ job });
  });

  // Opt-in metadata fetch from TheMovieDB. The client MUST send { confirm: true };
  // only an explicit user acknowledgement turns this into a write.
  app.post("/api/movies/:id/meta", async (req, res) => {
    const rec = findRec(req, res);
    if (!rec) return;
    if (req.body && req.body.confirm === true) {
      // pass
    } else {
      res.status(400).json({ error: "Opt-in required: send { confirm: true }" });
      return;
    }
    if (!tmd.configured) {
      res.status(502).json({ error: "TMDB_API_KEY not configured on server" });
      return;
    }
    try {
      const info = await tmd.fetchInfo(rec.cleanTitle, rec.yearGuess);
      if (!info) {
        res.status(404).json({ error: `No matching film found on TheMovieDB for "${rec.cleanTitle}"` });
        return;
      }

      writeInfo(lib.infoPath(rec), info);

      if (info.posterPath) {
        let written = false;
        try {
          await tmd.downloadPoster(info.posterPath, path.join(rec.dir, "poster.jpg"));
          written = true;
        } catch {
          try {
            await tmd.downloadPoster(info.posterPath, lib.dataPosterPath(rec.id));
            written = true;
          } catch {
            written = false;
          }
        }
        info.posterWritten = written;
      }

      lib.invalidate();
      res.json({ ok: true, movie: buildMovie(rec) });
    } catch (err) {
      const msg = err.code === "NO_KEY" ? "TMDB_API_KEY not configured on server" : `Metadata fetch failed: ${err.message}`;
      res.status(502).json({ error: msg });
    }
  });

  app.get("/api/healthz", (req, res) => res.json({ ok: true }));

  return app;
}

function main() {
  const cfg = loadConfig();
  const app = createApp(cfg);

  fs.mkdirSync(path.join(cfg.dataDir, POSTERS_DIR), { recursive: true });

  app.listen(cfg.port, cfg.host, () => {
    const baseUrl = `http://${cfg.host}:${cfg.port}`;
    console.log(`movienight server: ${baseUrl}`);
    console.log(`  movies:    ${cfg.movieDir}`);
    console.log(`  data:      ${cfg.dataDir}`);
    console.log(`  tmdb:      ${cfg.apiKey ? "configured" : "NOT configured (set TMDB_API_KEY)"}`);
  });
}

if (require.main === module) {
  main();
}

module.exports = { createApp };