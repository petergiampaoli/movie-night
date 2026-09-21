import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const electronBinary = require("electron"); // resolves to the binary path outside Electron
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(__dirname, "..");

const PORT = 5173;
const vite = spawn("npx", ["vite"], {
  cwd: appRoot,
  stdio: "inherit",
  env: process.env,
});

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
        if (Date.now() - started > timeoutMs) reject(new Error("Vite dev server did not start"));
        else setTimeout(tick, 250);
      });
    };
    tick();
  });
}

waitForPort(PORT)
  .then(() => {
    const electron = spawn(electronBinary, ["."], {
      cwd: appRoot,
      stdio: "inherit",
      env: { ...process.env, VITE_DEV_SERVER_URL: `http://localhost:${PORT}` },
    });
    const shutdown = () => {
      vite.kill("SIGTERM");
      electron.kill("SIGTERM");
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    electron.on("exit", (code) => {
      vite.kill("SIGTERM");
      process.exit(code === null ? 0 : code);
    });
  })
  .catch((err) => {
    console.error(err.message);
    vite.kill();
    process.exit(1);
  });