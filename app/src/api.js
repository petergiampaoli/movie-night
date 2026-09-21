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

  return {
    root,
    abs: (p) => new URL(p.replace(/^\//, ""), root).href,
    status: () => j("GET", "api/status"),
    movies: (favoritesOnly = false) =>
      j("GET", `api/movies${favoritesOnly ? "?favorites=1" : ""}`),
    movie: (id) => j("GET", `api/movies/${encodeURIComponent(id)}`),
    setFavorite: (id, favorite) =>
      j("POST", `api/movies/${encodeURIComponent(id)}/favorite`, { favorite }),
    fetchMeta: (id, confirm = true) =>
      j("POST", `api/movies/${encodeURIComponent(id)}/meta`, { confirm }),
  };
}