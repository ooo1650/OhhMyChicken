/* ==========================================================================
   PostgreSQL connection, schema migration and seeding.
   CLI:  node server/db.js init   → create tables + seed defaults if empty
         node server/db.js reset  → wipe everything and re-seed defaults
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const defaults = require('./defaults');
const { hashPasscode } = require('./passcode');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined
});

async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function migrate() {
  await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
}

async function insertMenu(client, list) {
  for (let i = 0; i < list.length; i++) {
    const m = list[i];
    await client.query(
      'INSERT INTO menu_items (id, category, name, diet, description, prices, available, popular, sort_order, image_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [m.id, m.category, m.name, m.diet, m.desc || '', JSON.stringify(m.prices), m.available !== false, !!m.popular, i, m.imageId || null]
    );
  }
}

// Seed each table only when it is empty, so restarts never clobber edits.
async function seed() {
  const envPass = process.env.ADMIN_PASSCODE || '';
  if (envPass && envPass.length < 8) throw new Error('ADMIN_PASSCODE must be at least 8 characters.');
  if (envPass === defaults.DEFAULT_PASSCODE) throw new Error('ADMIN_PASSCODE must not be the published default passcode.');
  await tx(async (c) => {
    const { rows } = await c.query('SELECT count(*)::int AS n FROM menu_items');
    if (!rows[0].n) await insertMenu(c, defaults.MENU);
    await c.query('INSERT INTO settings (id, data) VALUES (1, $1) ON CONFLICT (id) DO NOTHING', [JSON.stringify(defaults.SETTINGS)]);
    const pass = envPass || defaults.DEFAULT_PASSCODE;
    await c.query('INSERT INTO admin_auth (id, pass_hash, is_default) VALUES (1, $1, $2) ON CONFLICT (id) DO NOTHING',
      [await hashPasscode(pass), !envPass]);

    // The default passcode is public (it's in the code), so it must never guard a live site.
    const auth = await c.query('SELECT is_default FROM admin_auth WHERE id = 1');
    if (auth.rows[0].is_default) {
      if (envPass) {
        // ADMIN_PASSCODE replaces the default; it never overwrites a passcode changed in the dashboard.
        await c.query('UPDATE admin_auth SET pass_hash = $1, is_default = false, updated_at = now() WHERE id = 1', [await hashPasscode(envPass)]);
        await c.query('DELETE FROM admin_sessions');
      } else if (process.env.NODE_ENV === 'production') {
        throw new Error('The admin passcode is still the public default. Set ADMIN_PASSCODE (8+ characters) and start again.');
      }
    }
  });
}

async function reset() {
  await pool.query('TRUNCATE menu_items, settings, admin_auth, admin_sessions, orders RESTART IDENTITY');
  await seed();
}

module.exports = { pool, tx, migrate, seed, insertMenu };

if (require.main === module) {
  const cmd = process.argv[2];
  (async () => {
    await migrate();
    if (cmd === 'reset') { await reset(); console.log('Database wiped and re-seeded with defaults.'); }
    else { await seed(); console.log('Database ready.'); }
  })().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => pool.end());
}
