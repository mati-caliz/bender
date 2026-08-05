// Empaqueta dist/ en un ZIP listo para subir a la Chrome Web Store.
// Sin dependencias: escribe el formato ZIP a mano con deflate de zlib.
import { deflateRawSync } from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, i) => {
  let c = i;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const walk = (dir, base = '') =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const name = base ? `${base}/${entry.name}` : entry.name;
    return entry.isDirectory() ? walk(path.join(dir, entry.name), name) : [name];
  });

if (!fs.existsSync(path.join(DIST, 'manifest.json'))) {
  console.error('No hay dist/manifest.json. Corre "npm run build" primero.');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(path.join(DIST, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

if (manifest.version !== pkg.version) {
  console.error(`Version desalineada: manifest ${manifest.version} vs package ${pkg.version}.`);
  process.exit(1);
}

const includeMaps = !process.argv.includes('--no-maps');
const names = walk(DIST)
  .filter((name) => includeMaps || !name.endsWith('.map'))
  .sort();

const locals = [];
const central = [];
let offset = 0;

for (const name of names) {
  const raw = fs.readFileSync(path.join(DIST, name));
  const deflated = deflateRawSync(raw, { level: 9 });
  const stored = deflated.length >= raw.length;
  const body = stored ? raw : deflated;
  const method = stored ? 0 : 8;
  const nameBuf = Buffer.from(name, 'utf8');
  const crc = crc32(raw);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4); // version needed
  local.writeUInt16LE(0x0800, 6); // flags: nombres en UTF-8
  local.writeUInt16LE(method, 8);
  local.writeUInt32LE(0, 10); // fecha/hora: 0 = determinista
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(raw.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  locals.push(local, nameBuf, body);

  const dir = Buffer.alloc(46);
  dir.writeUInt32LE(0x02014b50, 0);
  dir.writeUInt16LE(20, 4); // version made by
  dir.writeUInt16LE(20, 6); // version needed
  dir.writeUInt16LE(0x0800, 8);
  dir.writeUInt16LE(method, 10);
  dir.writeUInt32LE(0, 12);
  dir.writeUInt32LE(crc, 16);
  dir.writeUInt32LE(body.length, 20);
  dir.writeUInt32LE(raw.length, 24);
  dir.writeUInt16LE(nameBuf.length, 28);
  dir.writeUInt32LE(offset, 42);
  central.push(dir, nameBuf);

  offset += local.length + nameBuf.length + body.length;
}

const centralBuf = Buffer.concat(central);
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0);
eocd.writeUInt16LE(names.length, 8);
eocd.writeUInt16LE(names.length, 10);
eocd.writeUInt32LE(centralBuf.length, 12);
eocd.writeUInt32LE(offset, 16);

const out = path.join(ROOT, `bender-${manifest.version}.zip`);
fs.writeFileSync(out, Buffer.concat([...locals, centralBuf, eocd]));

const kb = (fs.statSync(out).size / 1024).toFixed(1);
console.log(`${path.basename(out)} — ${names.length} archivos, ${kb} KB`);
