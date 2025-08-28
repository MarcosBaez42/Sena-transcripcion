const fs = require('fs');
const path = require('path');

const STORAGE_PATH = path.resolve(__dirname, 'archivosGenerados.json');

let cache = {};

function load() {
  try {
    cache = JSON.parse(fs.readFileSync(STORAGE_PATH, 'utf8'));
  } catch {
    cache = {};
  }
  // Remove entries whose files no longer exist
  const base = path.resolve(__dirname, '..', '..');
  for (const [id, rutas] of Object.entries(cache)) {
    const primera = Object.values(rutas).find(Boolean);
    if (!primera) continue;
    const absoluta = path.resolve(base, primera);
    if (!fs.existsSync(absoluta)) {
      delete cache[id];
    }
  }
  save();
}

function save() {
  fs.writeFileSync(STORAGE_PATH, JSON.stringify(cache, null, 2));
}

function get(id) {
  return cache[id];
}

function set(id, rutas) {
  cache[id] = rutas;
  save();
}

function remove(id) {
  delete cache[id];
  save();
}

load();

module.exports = {
  load,
  get,
  set,
  delete: remove,
};