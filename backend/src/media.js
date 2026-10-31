/* ==========================================================================
   Photos — uploads are decoded and re-encoded with sharp (so only real
   images get through), auto-rotated, stripped of EXIF/GPS data and saved
   as WebP in several widths. Postgres keeps the metadata and a copy of every
   file; UPLOAD_DIR holds the same files for fast serving. If that disk is
   wiped (some hosts do it on every deploy), files are restored on first request.
   ========================================================================== */
'use strict';
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { pool } = require('./db');
const { fail, clean } = require('./validate');
const { createGate } = require('./limit');

// Decoding a 50-megapixel photo takes ~200 MB; process one at a time.
const processGate = createGate(1, 20);

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'));
const WIDTHS = [320, 480, 640, 800, 1024, 1600];
const MAX_BYTES = 10 * 1024 * 1024;  // per upload
const MAX_PIXELS = 50e6;             // refuse decompression bombs
const MIN_SIDE = 200;                // too small to look good on a dish card
const ALT_MAX = 160;
const FILE_RE = /^[a-f0-9]{24}-\d{2,4}\.webp$/;

sharp.cache(false); // keep memory flat; every upload is processed once

async function ensureDir() { await fs.mkdir(UPLOAD_DIR, { recursive: true }); }

// Name the photo after the file until someone writes real alt text.
function altFromName(name) {
  return String(name || '').replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, ALT_MAX);
}

function toMedia(r) {
  const sizes = r.sizes.map((s) => ({ w: s.w, h: s.h, url: '/media/' + s.file }));
  return {
    id: r.id, alt: r.alt, width: r.width, height: r.height, placeholder: r.placeholder,
    sizes, url: (sizes.find((s) => s.w >= 1024) || sizes[sizes.length - 1]).url,
    gallery: r.in_gallery, order: r.sort_order
  };
}
// Admin view adds housekeeping fields.
function toAdminMedia(r) {
  return Object.assign(toMedia(r), {
    missing: r.stored != null && Number(r.stored) === 0, // the files were lost: upload it again
    originalName: r.original_name, bytes: r.bytes, createdAt: new Date(r.created_at).getTime(), usedBy: Number(r.used_by || 0)
  });
}

/* ---------- Upload ---------- */
function create(buffer, originalName) {
  return processGate.run(() => createNow(buffer, originalName));
}

async function createNow(buffer, originalName) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) fail('Choose a photo to upload.');
  if (buffer.length > MAX_BYTES) fail('That photo is over 10 MB. Please use a smaller one.');

  let meta;
  try { meta = await sharp(buffer, { limitInputPixels: MAX_PIXELS }).metadata(); }
  catch (e) {
    if (/pixel limit/i.test(e.message)) fail('That photo is too large (over 50 megapixels). Resize it first.');
    fail('That file is not a photo we can read. Use JPG, PNG, WebP or AVIF.');
  }
  if (!['jpeg', 'png', 'webp', 'avif', 'heif', 'gif', 'tiff'].includes(meta.format)) fail('Use a JPG, PNG, WebP or AVIF photo.');

  // Width/height after EXIF rotation (orientation 5–8 swaps them).
  const rotated = meta.orientation >= 5;
  const w0 = rotated ? meta.height : meta.width, h0 = rotated ? meta.width : meta.height;
  if (Math.min(w0, h0) < MIN_SIDE) fail('That photo is too small (' + w0 + '×' + h0 + '). Use one at least ' + MIN_SIDE + ' px on each side.');

  const id = crypto.randomBytes(12).toString('hex');
  // Every standard width below the original, plus the original (capped at the largest).
  const top = Math.min(w0, WIDTHS[WIDTHS.length - 1]);
  const widths = WIDTHS.filter((w) => w < top).concat(top);
  const base = sharp(buffer, { limitInputPixels: MAX_PIXELS }).rotate(); // rotate() applies EXIF orientation; output has no EXIF

  await ensureDir();
  const sizes = [], written = [], files = [];
  let bytes = 0;
  try {
    for (const w of widths) {
      const file = id + '-' + w + '.webp';
      const { data, info } = await base.clone().resize({ width: w, withoutEnlargement: true }).webp({ quality: 78, effort: 4 }).toBuffer({ resolveWithObject: true });
      await fs.writeFile(path.join(UPLOAD_DIR, file), data);
      written.push(file);
      files.push({ file, data });
      bytes += info.size;
      sizes.push({ w: info.width, h: info.height, file });
    }
    const tiny = await base.clone().resize({ width: 24 }).blur(1.2).webp({ quality: 40 }).toBuffer();
    const placeholder = 'data:image/webp;base64,' + tiny.toString('base64');
    const largest = sizes[sizes.length - 1];
    const { rows } = await pool.query(
      `INSERT INTO media (id, original_name, alt, width, height, bytes, sizes, placeholder, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM media)) RETURNING *, 0 AS used_by`,
      [id, String(originalName || '').slice(0, 200), altFromName(originalName), largest.w, largest.h, bytes, JSON.stringify(sizes), placeholder]
    );
    for (const f of files) await pool.query('INSERT INTO media_files (file, media_id, bytes) VALUES ($1, $2, $3)', [f.file, id, f.data]);
    return toAdminMedia(rows[0]);
  } catch (e) {
    await pool.query('DELETE FROM media WHERE id = $1', [id]).catch(() => {});
    await removeFiles(written);
    throw e;
  }
}

/* ---------- Serving and keeping files ---------- */
// A file that isn't on disk: fetch it from the database, put it back on disk, return it.
async function restoreFile(file) {
  if (!FILE_RE.test(file)) return null;
  const { rows } = await pool.query('SELECT bytes FROM media_files WHERE file = $1', [file]);
  if (!rows.length) return null;
  await ensureDir();
  await fs.writeFile(path.join(UPLOAD_DIR, file), rows[0].bytes).catch((e) => console.warn('media: could not write ' + file + ': ' + e.message));
  return rows[0].bytes;
}

// Photos uploaded before files were kept in the database: copy them in from the disk.
async function backfillFiles() {
  const { rows } = await pool.query(
    `SELECT m.id, s->>'file' AS file FROM media m CROSS JOIN LATERAL jsonb_array_elements(m.sizes) s
      WHERE NOT EXISTS (SELECT 1 FROM media_files f WHERE f.file = s->>'file')`);
  let copied = 0, missing = 0;
  for (const r of rows) {
    if (!FILE_RE.test(r.file)) continue;
    const data = await fs.readFile(path.join(UPLOAD_DIR, r.file)).catch(() => null);
    if (!data) { missing++; continue; }
    await pool.query('INSERT INTO media_files (file, media_id, bytes) VALUES ($1, $2, $3) ON CONFLICT (file) DO NOTHING', [r.file, r.id, data]);
    copied++;
  }
  if (copied) console.log('Photos: copied ' + copied + ' file(s) into the database.');
  if (missing) console.warn('Photos: ' + missing + ' file(s) are lost (not on disk or in the database). Upload those photos again.');
}

async function removeFiles(files) {
  await Promise.all(files.filter((f) => FILE_RE.test(f)).map((f) => fs.unlink(path.join(UPLOAD_DIR, f)).catch(() => {})));
}

/* ---------- Queries ---------- */
async function listAll() {
  const { rows } = await pool.query(
    `SELECT m.*, (SELECT count(*) FROM menu_items i WHERE i.image_id = m.id) AS used_by, (SELECT count(*) FROM media_files f WHERE f.media_id = m.id) AS stored
     FROM media m ORDER BY m.created_at DESC`
  );
  return rows.map(toAdminMedia);
}

async function listGallery() {
  const { rows } = await pool.query('SELECT * FROM media WHERE in_gallery ORDER BY sort_order, created_at DESC');
  return rows.map(toMedia);
}

async function update(id, raw) {
  const b = raw || {};
  const sets = [], vals = [id];
  if (b.alt !== undefined) {
    if (typeof b.alt !== 'string') fail('Description must be text.');
    const alt = clean(b.alt);
    if (alt.length > ALT_MAX) fail('Description must be at most ' + ALT_MAX + ' characters.');
    vals.push(alt); sets.push('alt = $' + vals.length);
  }
  if (b.gallery !== undefined) { vals.push(!!b.gallery); sets.push('in_gallery = $' + vals.length); }
  if (b.order !== undefined) {
    const n = Number(b.order);
    if (!Number.isInteger(n) || n < 0 || n > 100000) fail('Invalid position.');
    vals.push(n); sets.push('sort_order = $' + vals.length);
  }
  if (!sets.length) fail('Nothing to update.');
  const { rows } = await pool.query(
    'UPDATE media SET ' + sets.join(', ') + ', updated_at = now() WHERE id = $1 RETURNING *, (SELECT count(*) FROM menu_items i WHERE i.image_id = media.id) AS used_by',
    vals
  );
  return rows.length ? toAdminMedia(rows[0]) : null;
}

// Gallery order: ids in the order they should appear.
async function reorderGallery(ids) {
  if (!Array.isArray(ids) || ids.length > 500 || !ids.every((x) => typeof x === 'string')) fail('Invalid order.');
  await Promise.all(ids.map((id, i) => pool.query('UPDATE media SET sort_order = $2, updated_at = now() WHERE id = $1', [id, i])));
  return listAll();
}

async function remove(id) {
  const { rows } = await pool.query('DELETE FROM media WHERE id = $1 RETURNING sizes', [id]); // dishes are unlinked by ON DELETE SET NULL
  if (!rows.length) return false;
  await removeFiles(rows[0].sizes.map((s) => s.file));
  return true;
}

// One photo for public display, or null if it has been deleted (e.g. the hero picture).
async function getOne(id) {
  if (!id) return null;
  const { rows } = await pool.query('SELECT * FROM media WHERE id = $1', [id]);
  return rows.length ? toMedia(rows[0]) : null;
}

async function exists(id, client) {
  const { rows } = await (client || pool).query('SELECT 1 FROM media WHERE id = $1', [id]);
  return rows.length > 0;
}

module.exports = { UPLOAD_DIR, MAX_BYTES, create, listAll, listGallery, update, reorderGallery, remove, exists, getOne, toMedia, ensureDir, restoreFile, backfillFiles };
