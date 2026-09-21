const fs = require("node:fs");
const path = require("node:path");

const MIME_TYPES = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".webm": "video/webm",
  ".ogv": "video/ogg",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
  ".wmv": "video/x-ms-wmv",
  ".flv": "video/x-flv",
  ".mpg": "video/mpeg",
  ".mpeg": "video/mpeg",
  ".ts": "video/mp2t",
  ".3gp": "video/3gpp",
};

function streamVideo(req, res, filePath) {
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    res.status(404).json({ error: "File not found" });
    return;
  }
  if (!stat.isFile()) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.setHeader("Content-Type", MIME_TYPES[ext] || "application/octet-stream");
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "no-store");

  const range = req.headers.range;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    let start = match && match[1] !== "" ? parseInt(match[1], 10) : 0;
    let end = match && match[2] !== "" ? parseInt(match[2], 10) : stat.size - 1;
    if (!Number.isFinite(start) || start < 0) start = 0;
    if (!Number.isFinite(end)) end = stat.size - 1;

    if (start > end || start >= stat.size) {
      res.status(416);
      res.setHeader("Content-Range", `bytes */${stat.size}`);
      res.end();
      return;
    }

    end = Math.min(end, stat.size - 1);
    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
    res.setHeader("Content-Length", end - start + 1);
    fs.createReadStream(filePath, { start, end }).pipe(res);
    return;
  }

  res.setHeader("Content-Length", stat.size);
  fs.createReadStream(filePath).pipe(res);
}

module.exports = { streamVideo, MIME_TYPES };