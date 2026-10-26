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
      'INSERT INTO menu_items (id, category, name, diet, description, prices, available, popular, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [m.id, m.category, m.name, m.diet, m.desc || '', JSON.stringify(m.prices), m.available !== false, !!m.popular, i]
    );
  }
}

// Seed each table only when it is empty, so restarts never clobber edits.
async function seed() {
  await tx(async (c) => {
    const { rows } = await c.query('SELECT count(*)::int AS n FROM menu_items');
    if (!rows[0].n) await insertMenu(c, defaults.MENU);
    await c.query('INSERT INTO settings (id, data) VALUES (1, $1) ON CONFLICT (id) DO NOTHING', [JSON.stringify(defaults.SETTINGS)]);
    const pass = process.env.ADMIN_PASSCODE || defaults.DEFAULT_PASSCODE;
    if (pass.length < 6) throw new Error('ADMIN_PASSCODE must be at least 6 characters.');
    await c.query('INSERT INTO admin_auth (id, pass_hash, is_default) VALUES (1, $1, $2) ON CONFLICT (id) DO NOTHING',
      [await hashPasscode(pass), pass === defaults.DEFAULT_PASSCODE]);
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
