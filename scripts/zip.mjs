// Empaqueta dist/ en un ZIP listo para subir a la Chrome Web Store.
// Sin dependencias: escribe el formato ZIP a mano con deflate de zlib.
import { deflateRawSync } from "node:zlib";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");

const BYTE_VALUES = 256;
const BITS_PER_BYTE = 8;
const BYTE_MASK = 0xff;
const CRC_POLYNOMIAL = 0xedb88320;
const CRC_INITIAL = 0xffffffff;
const MAX_DEFLATE_LEVEL = 9;
const BYTES_PER_KILOBYTE = 1024;

const METHOD_STORED = 0;
const METHOD_DEFLATED = 8;
const ZIP_VERSION = 20;
const UTF8_NAMES_FLAG = 0x0800;
const DETERMINISTIC_TIMESTAMP = 0;

const LOCAL_HEADER = {
  size: 30,
  signature: 0x04034b50,
  offsets: {
    signature: 0,
    versionNeeded: 4,
    flags: 6,
    method: 8,
    timestamp: 10,
    crc: 14,
    compressedSize: 18,
    uncompressedSize: 22,
    nameLength: 26,
  },
};

const CENTRAL_HEADER = {
  size: 46,
  signature: 0x02014b50,
  offsets: {
    signature: 0,
    versionMadeBy: 4,
    versionNeeded: 6,
    flags: 8,
    method: 10,
    timestamp: 12,
    crc: 16,
    compressedSize: 20,
    uncompressedSize: 24,
    nameLength: 28,
    localHeaderOffset: 42,
  },
};

const END_OF_CENTRAL_DIRECTORY = {
  size: 22,
  signature: 0x06054b50,
  offsets: {
    signature: 0,
    entriesOnDisk: 8,
    totalEntries: 10,
    centralDirectorySize: 12,
    centralDirectoryOffset: 16,
  },
};

const CRC_TABLE = Uint32Array.from({ length: BYTE_VALUES }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < BITS_PER_BYTE; bit += 1) {
    crc = crc & 1 ? CRC_POLYNOMIAL ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

const crc32 = (buffer) => {
  let crc = CRC_INITIAL;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & BYTE_MASK] ^ (crc >>> BITS_PER_BYTE);
  }
  return (crc ^ CRC_INITIAL) >>> 0;
};

const walk = (dir, base = "") =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const name = base ? `${base}/${entry.name}` : entry.name;
    return entry.isDirectory() ? walk(path.join(dir, entry.name), name) : [name];
  });

const buildLocalHeader = ({ method, crc, body, raw, nameBuffer }) => {
  const { offsets } = LOCAL_HEADER;
  const header = Buffer.alloc(LOCAL_HEADER.size);
  header.writeUInt32LE(LOCAL_HEADER.signature, offsets.signature);
  header.writeUInt16LE(ZIP_VERSION, offsets.versionNeeded);
  header.writeUInt16LE(UTF8_NAMES_FLAG, offsets.flags);
  header.writeUInt16LE(method, offsets.method);
  header.writeUInt32LE(DETERMINISTIC_TIMESTAMP, offsets.timestamp);
  header.writeUInt32LE(crc, offsets.crc);
  header.writeUInt32LE(body.length, offsets.compressedSize);
  header.writeUInt32LE(raw.length, offsets.uncompressedSize);
  header.writeUInt16LE(nameBuffer.length, offsets.nameLength);
  return header;
};

const buildCentralHeader = ({ method, crc, body, raw, nameBuffer }, localHeaderOffset) => {
  const { offsets } = CENTRAL_HEADER;
  const header = Buffer.alloc(CENTRAL_HEADER.size);
  header.writeUInt32LE(CENTRAL_HEADER.signature, offsets.signature);
  header.writeUInt16LE(ZIP_VERSION, offsets.versionMadeBy);
  header.writeUInt16LE(ZIP_VERSION, offsets.versionNeeded);
  header.writeUInt16LE(UTF8_NAMES_FLAG, offsets.flags);
  header.writeUInt16LE(method, offsets.method);
  header.writeUInt32LE(DETERMINISTIC_TIMESTAMP, offsets.timestamp);
  header.writeUInt32LE(crc, offsets.crc);
  header.writeUInt32LE(body.length, offsets.compressedSize);
  header.writeUInt32LE(raw.length, offsets.uncompressedSize);
  header.writeUInt16LE(nameBuffer.length, offsets.nameLength);
  header.writeUInt32LE(localHeaderOffset, offsets.localHeaderOffset);
  return header;
};

const buildEndOfCentralDirectory = (entryCount, centralDirectorySize, centralDirectoryOffset) => {
  const { offsets } = END_OF_CENTRAL_DIRECTORY;
  const record = Buffer.alloc(END_OF_CENTRAL_DIRECTORY.size);
  record.writeUInt32LE(END_OF_CENTRAL_DIRECTORY.signature, offsets.signature);
  record.writeUInt16LE(entryCount, offsets.entriesOnDisk);
  record.writeUInt16LE(entryCount, offsets.totalEntries);
  record.writeUInt32LE(centralDirectorySize, offsets.centralDirectorySize);
  record.writeUInt32LE(centralDirectoryOffset, offsets.centralDirectoryOffset);
  return record;
};

const compressEntry = (name) => {
  const raw = fs.readFileSync(path.join(DIST, name));
  const deflated = deflateRawSync(raw, { level: MAX_DEFLATE_LEVEL });
  const stored = deflated.length >= raw.length;
  return {
    raw,
    body: stored ? raw : deflated,
    method: stored ? METHOD_STORED : METHOD_DEFLATED,
    nameBuffer: Buffer.from(name, "utf8"),
    crc: crc32(raw),
  };
};

if (!fs.existsSync(path.join(DIST, "manifest.json"))) {
  console.error('No hay dist/manifest.json. Corre "npm run build" primero.');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(path.join(DIST, "manifest.json"), "utf8"));
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

if (manifest.version !== pkg.version) {
  console.error(`Version desalineada: manifest ${manifest.version} vs package ${pkg.version}.`);
  process.exit(1);
}

const includeMaps = !process.argv.includes("--no-maps");
const names = walk(DIST)
  .filter((name) => includeMaps || !name.endsWith(".map"))
  .sort();

const locals = [];
const central = [];
let offset = 0;

for (const name of names) {
  const entry = compressEntry(name);
  const localHeader = buildLocalHeader(entry);
  locals.push(localHeader, entry.nameBuffer, entry.body);
  central.push(buildCentralHeader(entry, offset), entry.nameBuffer);
  offset += localHeader.length + entry.nameBuffer.length + entry.body.length;
}

const centralBuffer = Buffer.concat(central);
const endOfCentralDirectory = buildEndOfCentralDirectory(names.length, centralBuffer.length, offset);

const out = path.join(ROOT, `bender-${manifest.version}.zip`);
fs.writeFileSync(out, Buffer.concat([...locals, centralBuffer, endOfCentralDirectory]));

const kilobytes = (fs.statSync(out).size / BYTES_PER_KILOBYTE).toFixed(1);
console.log(`${path.basename(out)} — ${names.length} archivos, ${kilobytes} KB`);
