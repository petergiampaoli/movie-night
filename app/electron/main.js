const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { spawn } = require("node:child_process");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

let mainWindow = null;
let serverProc = null;

function pickFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

function waitForServer(baseUrl, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      const req = http.get(`${baseUrl}/api/healthz`, { timeout: 1500 }, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", retry);
      req.on("timeout", () => {
        req.destroy();
        retry();
      });
      function retry() {
        req.destroy();
        if (Date.now() - started > timeoutMs) reject(new Error("Local server did not start"));
        else setTimeout(tick, 200);
      }
    };
    tick();
  });
}

async function stopLocalServer() {
  const proc = serverProc;
  serverProc = null;
  if (!proc || proc.killed) return;
  proc.kill("SIGTERM");
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      resolve();
    }, 3000);
    proc.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function startLocalServer(dir) {
  await stopLocalServer();
  const port = await pickFreePort();
  const entry = path.join(__dirname, "..", "..", "server", "src", "index.js");
  const child = spawn(process.env.MOVIENIGHT_NODE || "node", [entry], {
    env: { ...process.env, MOVIE_DIR: dir, PORT: String(port), HOST: "127.0.0.1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  serverProc = child;
  child.stderr.on("data", (d) => {
    if (process.env.DEBUG) process.stderr.write(d);
  });

  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.on("exit", (code) => {
    const stillActive = serverProc === child;
    serverProc = null;
    if (stillActive && code !== 0 && mainWindow) {
      mainWindow.webContents.send("movienight:serverStopped");
    }
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await waitForServer(baseUrl);
  } catch (err) {
    child.kill("SIGKILL");
    throw err;
  }
  void exited;
  return { baseUrl, movieDir: dir };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 720,
    minHeight: 560,
    backgroundColor: "#141414",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) mainWindow.loadURL(devUrl);
  else mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

ipcMain.handle("movienight:selectFolder", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: "Choose a movie folder",
    buttonLabel: "Use this folder",
    properties: ["openDirectory"],
  });
  return canceled ? null : filePaths[0];
});

ipcMain.handle("movienight:startLocalServer", (event, dir) => {
  if (typeof dir !== "string" || !dir) throw new Error("No folder selected");
  return startLocalServer(dir);
});

ipcMain.handle("movienight:stopLocalServer", () => stopLocalServer());

ipcMain.handle("movienight:openExternal", (event, url) => {
  if (typeof url === "string" && /^https?:\/\//i.test(url)) shell.openExternal(url);
});

app.on("before-quit", () => {
  const proc = serverProc;
  serverProc = null;
  if (proc && !proc.killed) proc.kill("SIGTERM");
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});