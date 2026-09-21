const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const DEFAULT_PORT = 8787;

function loadConfig(env = process.env) {
  const movieDir = env.MOVIE_DIR ? path.resolve(env.MOVIE_DIR) : path.resolve(".");
  let dataDir = env.DATA_DIR ? path.resolve(env.DATA_DIR) : path.join(movieDir, ".movienight");

  // If the chosen movie folder is not writable, fall back to a per-user data dir.
  const dataDirNotWritable = env.DATA_DIR ? false : !isWritable(movieDir);
  if (dataDirNotWritable) {
    const digest = crypto.createHash("sha1").update(movieDir).digest("hex").slice(0, 8);
    dataDir = path.join(os.tmpdir(), `movienight-${digest}`);
  }

  const port = parseInt(env.PORT, 10);
  return {
    host: env.HOST || "127.0.0.1",
    port: Number.isFinite(port) && port > 0 ? port : DEFAULT_PORT,
    movieDir,
    dataDir,
    apiKey: (env.TMDB_API_KEY || "").trim(),
  };
}

function isWritable(dir) {
  try {
    const test = path.join(dir, `.movienight-write-test-${process.pid}`);
    require("node:fs").writeFileSync(test, "x");
    require("node:fs").unlinkSync(test);
    return true;
  } catch {
    return false;
  }
}

module.exports = { loadConfig, DEFAULT_PORT };