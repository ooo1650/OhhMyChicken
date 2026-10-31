/* Builds every logo file the site uses from frontend/brand/logo.png.
   Run after replacing the logo:  node frontend/scripts/brand-assets.cjs
   (sharp comes from the backend's dependencies; the frontend does not need it at runtime.) */
const fs = require('fs');
const path = require('path');
const sharp = require(require.resolve('sharp', { paths: [path.join(__dirname, '../../backend')] }));

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'brand/logo.png');
const PUB = path.join(ROOT, 'public');
const CREAM = { r: 255, g: 248, b: 230, alpha: 1 };
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

// The logo trimmed to its edges, centred on a square of `size` with `pad` (0–1) margin.
async function square(logo, size, pad, background) {
  const inner = Math.round(size * (1 - 2 * pad));
  const img = await sharp(logo).resize(inner, inner, { fit: 'contain', background: CLEAR }).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background } }).composite([{ input: img, gravity: 'centre' }]);
}

// A .ico holding PNG images (supported by every browser since IE Vista era).
function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach(({ size, buf }, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(size % 256, e); head.writeUInt8(size % 256, e + 1);
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(buf.length, e + 8); head.writeUInt32LE(offset, e + 12);
    offset += buf.length;
  });
  return Buffer.concat([head, ...pngs.map((p) => p.buf)]);
}

async function main() {
  const logo = await sharp(SRC).trim().png().toBuffer();
  const png = (s) => s.png({ compressionLevel: 9, palette: true, quality: 90, effort: 10 });
  const out = (rel) => path.join(PUB, rel);
  const write = async (rel, s) => { await s.toFile(out(rel)); console.log(rel.padEnd(32), fs.statSync(out(rel)).size, 'B'); };

  // Browser tab: a tighter crop reads better at 16–48 px.
  const icoPngs = [];
  for (const size of [16, 32, 48]) icoPngs.push({ size, buf: await png(await square(logo, size, 0, CLEAR)).toBuffer() });
  fs.writeFileSync(out('favicon.ico'), ico(icoPngs));
  console.log('favicon.ico'.padEnd(32), fs.statSync(out('favicon.ico')).size, 'B');
  await write('assets/icon-192.png', png(await square(logo, 192, 0.02, CLEAR)));
  await write('assets/icon-512.png', png(await square(logo, 512, 0.02, CLEAR)));
  // Android crops maskable icons to a circle: keep the logo inside the 80% safe zone.
  await write('assets/icon-maskable-512.png', png(await square(logo, 512, 0.12, CREAM)));
  // iOS fills transparency with black, so give it the site's cream.
  await write('assets/apple-touch-icon.png', png(await square(logo, 180, 0.06, CREAM)));

  // Social / search preview, 1200×630: logo on a cream card with a yellow sun behind it.
  const sun = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">' +
    '<defs><radialGradient id="g"><stop offset="0" stop-color="#FFE38A"/><stop offset=".7" stop-color="#FFC72C" stop-opacity=".55"/><stop offset="1" stop-color="#FFF8E6" stop-opacity="0"/></radialGradient></defs>' +
    '<rect width="1200" height="630" fill="#FFF8E6"/><circle cx="600" cy="315" r="420" fill="url(#g)"/>' +
    '<rect y="600" width="1200" height="30" fill="#E50914"/><rect y="0" width="1200" height="14" fill="#E50914"/></svg>');
  const big = await sharp(logo).resize({ height: 540 }).toBuffer();
  await write('assets/og-image.png', sharp(sun).composite([{ input: big, gravity: 'centre' }]).png({ compressionLevel: 9, palette: true, quality: 90 }));

  // On-page logo (bundled by Vite with a content hash, so browsers cache it for a year).
  for (const h of [128, 240]) {
    const f = path.join(ROOT, 'src/assets/logo-' + h + '.webp');
    await sharp(logo).resize({ height: h }).webp({ quality: 86, alphaQuality: 90, effort: 6 }).toFile(f);
    console.log(('src/assets/logo-' + h + '.webp').padEnd(32), fs.statSync(f).size, 'B');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
