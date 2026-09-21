# movienight 🍿

A Netflix-style player for the movies you already own, on your own machine or your own
little corner of the network. Your movie files stay on your disk — movienight scans,
indexes partial metadata on demand, writes opt-in TMDB posters/info as sidecar files
next to each movie, and then plays them in a Netflix-like grid UI.

> **Privacy / opt-in behavior.** Metadata (poster, synopsis, tagline, ratings) is
> **never** downloaded automatically. The card shows a **“Get movie information”**
> button instead; information stays *missing* unless you click it and explicitly
> confirm in the follow-up dialog. Each fetch also requires `confirm: true` on the
> server API. TheMovieDB results are written as sidecars (`poster.jpg`, `info.json`)
> beside the movie file.

## What's inside

```
movienight/
  server/   Node media server (Express)
    src/    config, library scanner, video streaming (HTTP Range), TMDB opt-in metadata,
            favorites persistence
    test/   node:test suites (library + HTTP API, streaming, opt-in)
  app/      Desktop client (Electron + React + Vite)
    electron/  main, preload, IPC bridge (local server + folder picker)
    src/       renderer: card grid, browse/search/favorites, detail modal, HTML5 player
```

## Run it

Prereqs: **Node 18+** (server) and npm.

### Option A — full desktop app (Electron + local server)

```sh
cd movienight/app
npm install
npm run dev        # launches Vite + Electron; pick a folder to scan, or connect to a server URL
```

### Option B — just the media server (headless)

```sh
cd movienight/server
npm install
MOVIE_DIR="/Users/you/Movies" npm start    # http://127.0.0.1:8787
```

Then connect the app (or any browser) to `http://127.0.0.1:8787`.

Config env vars (server):

| Var | Meaning |
| --- | --- |
| `MOVIE_DIR` | Folder to scan for video files |
| `PORT` / `HOST` | Host/port to listen on (default `8787` / `127.0.0.1`) |
| `TMDB_API_KEY` | **Optional** — enables the opt-in "Get movie information" button |
| `DATA_DIR` | Where favorites + cached posters live (default `<movieDir>/.movienight`) |

## API (server)

- `GET /api/status` — server health, movie count, TMDB config
- `GET /api/movies` — library (add `?favorites=1` to filter)
- `GET /api/movies/:id` — one movie (with sidecar info if present)
- `GET /api/movies/:id/poster` — poster image (sidecar or data-dir cache)
- `GET /api/movies/:id/stream` — video stream (supports HTTP `Range` for seeking)
- `POST /api/movies/:id/favorite` — `{ "favorite": true|false }`
- `POST /api/movies/:id/meta` — **opt-in** metadata; requires body `{ "confirm": true }` from a
  user-clicked confirmation, otherwise it is refused (`400`). Refuses without a configured key (`502`).
  Writes `info.json` + `poster.jpg` next to the movie when confirmed.

## Tests

```sh
cd movienight/server && npm test     # node:test — library + api/stream/favorites/opt-in
```

## Notes

- Sidecar detection looks for `poster.jpg|jpeg|png|webp` and `info.json` beside each video.
- Playback uses the browser/Chromium codec support — `.mp4` (h.264) works everywhere; some
  `.mkv`/`.avi` require additional codecs on your OS.
- "Ratings" shown come from TheMovieDB (opt-in); external links to IMDb / Letterboxd /
  TheMovieDB are provided from the metadata sidecar.
