const fs = require("node:fs");
const path = require("node:path");

function atomicWrite(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, contents);
  fs.renameSync(tmp, file);
}

function writeInfo(filePath, data) {
  atomicWrite(filePath, JSON.stringify(data, null, 2));
}

function writePoster(filePath, buffer) {
  atomicWrite(filePath, buffer);
}

module.exports = { atomicWrite, writeInfo, writePoster };