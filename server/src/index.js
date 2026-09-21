const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const cors = require("cors");

const { loadConfig } = require("./config");
const { Library, POSTERS_DIR } = require("./library");
const { streamVideo } = require("./stream");
const { Favorites } = require("./favorites");
const { Tmdb } = require("./tmdb");
const { writeInfo, writePoster } = require("./metadata");
const pkg = require("../package.json");

function createApp({
  movieDir,
  dataDir,
  apiKey,
  library,
  favorites,
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
  const tmd = tmdb || new Tmdb(apiKey !== undefined ? apiKey : cfg.apiKey);

  function buildMovie(rec) {
    const info = lib.readInfo(rec);
    const poster = lib.posterPath(rec) || (fs.existsSync(lib.dataPosterPath(rec.id)) ? lib.dataPosterPath(rec.id) : null);
    return {
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
      tmdbId: (info && info.tmdbId) || null,
      imdbId: (info && info.imdbId) || null,
      source: (info && info.source) || null,
      fetchedAt: (info && info.fetchedAt) || null,
      hasInfo: Boolean(info),
      hasPoster: Boolean(poster),
      favorite: favs.has(rec.id),
      posterUrl: poster ? `/api/movies/${rec.id}/poster` : null,
      streamUrl: `/api/movies/${rec.id}/stream`,
    };
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
    let recs = lib.list();
    if (favoritesOnly) recs = recs.filter((r) => favs.has(r.id));
    const movies = recs
      .map(buildMovie)
      .sort((a, b) => a.title.localeCompare(b.title));
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