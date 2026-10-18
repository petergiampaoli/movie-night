const fs = require("node:fs");
const path = require("node:path");

// Optical-disc detection.
//
// Discs appear as mounted folders under /Volumes on macOS:
//   <mount>/VIDEO_TS   -> DVD
//   <mount>/BDMV       -> Blu-ray
// MakeMKV needs the raw device node (dev:/dev/diskN), which we ask diskutil for.
// HandBrake can read the mount point directly.

function runExecFile(cmd, args, cb) {
  const { execFile } = require("node:child_process");
  execFile(cmd, args, { maxBuffer: 8 * 1024 * 1024 }, cb);
}

function listVolumes(volumesDir) {
  let entries;
  try {
    entries = fs.readdirSync(volumesDir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => path.join(volumesDir, e.name))
    .sort();
}

function classifyDisc(mount) {
  if (fs.existsSync(path.join(mount, "BDMV"))) return "bluray";
  if (fs.existsSync(path.join(mount, "VIDEO_TS"))) return "dvd";
  return null;
}

// MakeMKV wants the whole disc (e.g. /dev/disk2), not a slice (/dev/disk2s1).
function normalizeDevice(device) {
  if (!device) return null;
  return /s\d+$/.test(device) ? device.replace(/s\d+$/, "") : device;
}

function deviceFor(mount, run) {
  return new Promise((resolve) => {
    run("diskutil", ["info", mount], (err, stdout) => {
      if (err) return resolve(null);
      const m = /Device Node:\s*(\/dev\/[^\s]+)/i.exec(String(stdout || ""));
      resolve(m ? normalizeDevice(m[1]) : null);
    });
  });
}

// Returns [{ label, mount, device, type: "dvd"|"bluray" }]
async function detectDiscs({ volumesDir = "/Volumes", run = runExecFile } = {}) {
  const discs = [];
  for (const mount of listVolumes(volumesDir)) {
    const type = classifyDisc(mount);
    if (!type) continue;
    const device = await deviceFor(mount, run);
    discs.push({ label: path.basename(mount), mount, type, device });
  }
  return discs;
}

module.exports = { detectDiscs, listVolumes, classifyDisc, normalizeDevice };
