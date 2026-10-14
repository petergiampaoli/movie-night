// Demo launcher (one command): starts the movienight media server on the fixed
// dummy port (1234) pointed at the committed e2e fixtures, then launches the
// desktop app via `npm start`.
//
//   npm run demo
//
// The connect screen's server field is pre-filled with http://127.0.0.1:1234,
// so once the app opens you just press Connect. Ctrl+C stops everything.

import { spawn } from "node:child_process";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(__dirname, "..");
const repoRoot = path.join(appRoot, "..");

const API_PORT = 1234;
const MOVIE_DIR = path.join(appRoot, "demo-data", "movies");
const DATA_DIR = path.join(appRoot, "demo-data", ".data");
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

let server = null;
let app = null;

function shutdown(code = 0) {
  if (app && !app.killed) app.kill("SIGTERM");
  if (server && !server.killed) server.kill("SIGTERM");
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

function waitForPort(port, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      const sock = net.connect(port, "127.0.0.1");
      sock.once("connect", () => {
        sock.destroy();
        resolve();
      });
      sock.once("error", () => {
        sock.destroy();
        if (Date.now() - started > timeoutMs) reject(new Error(`port ${port} did not open`));
        else setTimeout(tick, 250);
      });
    };
    tick();
  });
}

function portInUse(port) {
  return new Promise((resolve) => {
    const sock = net.connect(port, "127.0.0.1");
    sock.once("connect", () => {
      sock.destroy();
      resolve(true);
    });
    sock.once("error", () => {
      sock.destroy();
      resolve(false);
    });
  });
}

async function main() {
  if (!fs.existsSync(MOVIE_DIR) || fs.readdirSync(MOVIE_DIR).length === 0) {
    console.error(
      `\nDemo library not built yet: ${MOVIE_DIR}\n` +
        "Build it once with:  npm run demo:data   (needs a TMDB_API_KEY)\n"
    );
    process.exit(1);
  }

  if (await portInUse(API_PORT)) {
    console.error(`Port ${API_PORT} is already in use. Stop the other server (or the previous demo) and retry.`);
    process.exit(1);
  }

  server = spawn("node", [path.join(repoRoot, "server", "src", "index.js")], {
    env: {
      ...process.env,
      MOVIE_DIR,
      DATA_DIR,
      PORT: String(API_PORT),
      HOST: "127.0.0.1",
    },
    stdio: "inherit",
  });
  server.on("exit", (code) => {
    if (code) shutdown(code);
  });

  await waitForPort(API_PORT);
  console.log(`\n  dummy library server : http://127.0.0.1:${API_PORT}`);
  console.log(`  launching desktop app (npm start) - connect field is pre-filled\n`);

  app = spawn(npmCmd, ["start"], { cwd: appRoot, stdio: "inherit", env: process.env });
  app.on("exit", (code) => shutdown(code ?? 0));
}

main().catch((err) => {
  console.error(err.message);
  shutdown(1);
});
