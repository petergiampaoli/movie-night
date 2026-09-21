const fs = require("node:fs");
const path = require("node:path");

class Favorites {
  constructor(file) {
    this.file = file;
    this.ids = new Set();
    this.load();
  }

  load() {
    try {
      const data = JSON.parse(fs.readFileSync(this.file, "utf8"));
      if (Array.isArray(data)) this.ids = new Set(data);
    } catch {
      this.ids = new Set();
    }
  }

  save() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify([...this.ids], null, 2));
      fs.renameSync(tmp, this.file);
    } catch {
      // Favorites persistence is best-effort.
    }
  }

  has(id) {
    return this.ids.has(id);
  }

  set(id, favorite) {
    if (favorite) this.ids.add(id);
    else this.ids.delete(id);
    this.save();
    return favorite;
  }
}

module.exports = { Favorites };