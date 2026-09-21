const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_IMAGE = "https://image.tmdb.org/t/p/w342";

class Tmdb {
  constructor(apiKey) {
    this.apiKey = apiKey || "";
    this.configured = Boolean(this.apiKey);
  }

  _url(endpoint, params) {
    const query = new URLSearchParams({
      api_key: this.apiKey,
      language: "en-US",
      ...params,
    });
    return `${TMDB_API}${endpoint}?${query.toString()}`;
  }

  async _get(endpoint, params) {
    if (!this.configured) {
      const err = new Error("TMDB API key not configured on server");
      err.code = "NO_KEY";
      throw err;
    }
    const res = await fetch(this._url(endpoint, params));
    if (!res.ok) {
      const err = new Error(`TheMovieDB returned ${res.status}`);
      err.code = "API_ERROR";
      throw err;
    }
    const data = await res.json();
    if (data.success === false) {
      const err = new Error(data.status_message || "TheMovieDB request failed");
      err.code = "API_ERROR";
      throw err;
    }
    return data;
  }

  async search(title, year) {
    const params = { query: title, include_adult: "false" };
    if (year) params.year = String(year);
    const data = await this._get("/search/movie", params);
    const results = (data.results || [])[0];
    return results ? results.id : null;
  }

  async detail(id) {
    return this._get(`/movie/${id}`);
  }

  async fetchInfo(title, year) {
    const tmdbId = await this.search(title, year);
    if (!tmdbId) return null;
    const d = await this.detail(tmdbId);
    const releaseYear = (d.release_date || "").slice(0, 4);
    return {
      title: d.title || title,
      year: releaseYear || year || null,
      tagline: d.tagline || null,
      overview: d.overview || null,
      rating: typeof d.vote_average === "number" ? d.vote_average : null,
      voteCount: typeof d.vote_count === "number" ? d.vote_count : null,
      genres: (d.genres || []).map((g) => g.name),
      runtime: typeof d.runtime === "number" ? d.runtime : null,
      tmdbId: d.id || null,
      imdbId: d.imdb_id || null,
      posterPath: d.poster_path || null,
      backdropPath: d.backdrop_path || null,
      source: "tmdb",
      fetchedAt: new Date().toISOString(),
    };
  }

  async posterUrl(posterPath) {
    return posterPath ? `${TMDB_IMAGE}${posterPath}` : null;
  }

  async downloadPoster(posterPath, dest) {
    const url = await this.posterUrl(posterPath);
    if (!url) return false;
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) throw Object.assign(new Error(`Poster download failed (${res.status})`), { code: "POSTER" });
    const buf = Buffer.from(await res.arrayBuffer());
    await requireReplace(dest, buf);
    return true;
  }
}

function requireReplace(file, contents) {
  const fs = require("node:fs");
  const path = require("node:path");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, contents);
  fs.renameSync(tmp, file);
}

module.exports = { Tmdb };