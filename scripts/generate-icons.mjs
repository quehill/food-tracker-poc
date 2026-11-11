// Generates placeholder PWA icons (solid PNGs) without extra dependencies.
// Usage: npm run icons
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const OUT = new URL('../public/icons/', import.meta.url);
const BG = [0x15, 0x80, 0x3d];
const FG = [0xff, 0xff, 0xff];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Green square with a white ring; `ringScale` keeps the mark inside the maskable safe zone. */
function icon(size, ringScale) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  const c = size / 2;
  const outer = size * ringScale;
  const inner = outer * 0.62;
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
      const color = d <= outer && d >= inner ? FG : BG;
      raw.set(color, row + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT, { recursive: true });
writeFileSync(new URL('icon-192.png', OUT), icon(192, 0.3));
writeFileSync(new URL('icon-512.png', OUT), icon(512, 0.3));
writeFileSync(new URL('icon-maskable-512.png', OUT), icon(512, 0.22));
writeFileSync(new URL('apple-touch-icon.png', OUT), icon(180, 0.3));
writeFileSync(
  new URL('favicon.svg', OUT),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#15803d"/><circle cx="32" cy="32" r="15.5" fill="none" stroke="#fff" stroke-width="7"/></svg>\n`,
);
console.log('Icons written to public/icons/');
