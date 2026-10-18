export function api(baseUrl) {
  const root = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

  async function j(method, url, body) {
    const res = await fetch(root + url, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let data = {};
    try {
      data = await res.json();
    } catch {
      /* non-JSON response */
    }
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  // Upload streams the file to the server, which writes it straight into the
  // library folder. XMLHttpRequest is used because fetch() has no upload
  // progress events.
  function upload(file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${root}api/import?name=${encodeURIComponent(file.name)}`);
      xhr.setRequestHeader("Content-Type", "application/octet-stream");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        let data = {};
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          /* non-JSON */
        }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data.error || `Upload failed (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error("Upload failed — network error"));
      xhr.onabort = () => reject(new Error("Upload cancelled"));
      xhr.send(file);
    });
  }

  return {
    root,
    abs: (p) => new URL(p.replace(/^\//, ""), root).href,
    status: () => j("GET", "api/status"),
    movies: (favoritesOnly = false) =>
      j("GET", `api/movies${favoritesOnly ? "?favorites=1" : ""}`),
    movie: (id) => j("GET", `api/movies/${encodeURIComponent(id)}`),
    setFavorite: (id, favorite) =>
      j("POST", `api/movies/${encodeURIComponent(id)}/favorite`, { favorite }),
    setWatchlist: (id, watchlist) =>
      j("POST", `api/movies/${encodeURIComponent(id)}/watchlist`, { watchlist }),
    fetchMeta: (id, confirm = true) =>
      j("POST", `api/movies/${encodeURIComponent(id)}/meta`, { confirm }),
    upload,
    tools: () => j("GET", "api/tools"),
    discs: () => j("GET", "api/discs"),
    rips: () => j("GET", "api/rips"),
    startRip: (body) => j("POST", "api/rips", body),
    ripStatus: (id) => j("GET", `api/rips/${encodeURIComponent(id)}`),
    cancelRip: (id) => j("DELETE", `api/rips/${encodeURIComponent(id)}`),
  };
}