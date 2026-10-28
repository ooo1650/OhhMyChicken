/* ==========================================================================
   PostgreSQL connection, schema migration and seeding.
   CLI:  node src/db.js init        → create tables + seed defaults if empty
         node src/db.js reset-menu  → replace only the menu with defaults.js (keeps orders, settings, photos)
         node src/db.js reset       → wipe everything and re-seed defaults
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const defaults = require('./defaults');
const { hashPasscode, weakness } = require('./passcode');

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
      'INSERT INTO menu_items (id, category, name, diet, description, prices, available, popular, sort_order, image_id, art) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      [m.id, m.category, m.name, m.diet, m.desc || '', JSON.stringify(m.prices), m.available !== false, !!m.popular, i, m.imageId || null, m.art || '']
    );
  }
}

// Seed each table only when it is empty, so restarts never clobber edits.
// Branches saved before outlets had map pins: give the original ones their default
// pin, as long as their address is still the default one. Pins set by hand stay.
async function backfillOutletPins(c) {
  const { rows } = await c.query('SELECT data FROM settings WHERE id = 1');
  const outlets = rows.length && Array.isArray(rows[0].data.outlets) ? rows[0].data.outlets : null;
  if (!outlets) return;
  let filled = 0;
  const next = outlets.map((o) => {
    const d = defaults.SETTINGS.outlets.find((x) => x.id === o.id);
    if (!d || o.lat != null || o.lng != null || o.address !== d.address) return o;
    filled++;
    return { ...o, lat: d.lat, lng: d.lng };
  });
  if (!filled) return;
  await c.query("UPDATE settings SET data = jsonb_set(data, '{outlets}', $1::jsonb) WHERE id = 1", [JSON.stringify(next)]);
  console.log('Added map pins to ' + filled + ' outlet(s).');
}

async function seed() {
  const envPass = process.env.ADMIN_PASSCODE || '';
  if (envPass === defaults.DEFAULT_PASSCODE) throw new Error('ADMIN_PASSCODE must not be the published default passcode.');
  // Strength is checked only when ADMIN_PASSCODE is about to be used (new database, or
  // still on the default); once staff set their own, it is ignored, so old values don't block start-up.
  const envWeak = envPass ? weakness(envPass) : '';
  await tx(async (c) => {
    const { rows } = await c.query('SELECT count(*)::int AS n FROM menu_items');
    if (!rows[0].n) await insertMenu(c, defaults.MENU);
    await c.query('INSERT INTO settings (id, data) VALUES (1, $1) ON CONFLICT (id) DO NOTHING', [JSON.stringify(defaults.SETTINGS)]);
    await backfillOutletPins(c);
    const existing = await c.query('SELECT is_default FROM admin_auth WHERE id = 1');
    if (envWeak && (!existing.rows.length || existing.rows[0].is_default)) throw new Error('ADMIN_PASSCODE is too weak: ' + envWeak);
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
        throw new Error('The admin passcode is still the public default. Set ADMIN_PASSCODE (10+ characters, not easy to guess) and start again.');
      }
    }
  });
}

async function reset() {
  await pool.query('TRUNCATE menu_items, settings, admin_auth, admin_sessions, admin_logins, orders, customers, events, analytics_salt RESTART IDENTITY');
  await seed();
}

module.exports = { pool, tx, migrate, seed, insertMenu };

// Forgotten passcode: whoever can run commands on the server sets a new one.
// Nothing else changes; every device is signed out.
//   docker compose exec backend node src/db.js set-passcode
// It asks for the passcode (typing stays hidden). Without a terminal, set NEW_PASSCODE.
async function setPasscode() {
  const pass = process.env.NEW_PASSCODE || await askHidden();
  const weak = weakness(pass);
  if (weak) throw new Error('Passcode not changed. ' + weak);
  if (pass === defaults.DEFAULT_PASSCODE) throw new Error('Passcode not changed: that is the published default.');
  const hash = await hashPasscode(pass);
  await tx(async (c) => {
    await c.query(`INSERT INTO admin_auth (id, pass_hash, is_default) VALUES (1, $1, false)
      ON CONFLICT (id) DO UPDATE SET pass_hash = EXCLUDED.pass_hash, is_default = false, updated_at = now()`, [hash]);
    await c.query('DELETE FROM admin_sessions');
  });
  console.log('Passcode changed. Every device has been signed out; sign in with the new passcode.');
}

// Opt-in customer list, for the site operator only (never in the dashboard):
//   docker compose exec -T backend node src/db.js customers > customers.csv
async function exportCustomers() {
  const { rows } = await pool.query('SELECT name, phone, orders, outlet, consent_at, last_order FROM customers ORDER BY last_order DESC');
  const cell = (v) => { let s = v == null ? '' : v instanceof Date ? v.toISOString() : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  process.stdout.write(['Name', 'Phone', 'Orders', 'Last outlet', 'Consent given', 'Last order'].map(cell).join(',') + '\n' +
    rows.map((r) => [r.name, r.phone, r.orders, r.outlet, r.consent_at, r.last_order].map(cell).join(',')).join('\n') + (rows.length ? '\n' : ''));
  console.error(rows.length + ' customer(s).');
}
// A customer asks to be removed:  docker compose exec backend node src/db.js forget-customer 9841234567
async function forgetCustomerCli(phone) {
  const key = String(phone || '').replace(/\D/g, '').slice(-10);
  if (key.length < 7) throw new Error('Give the phone number: node src/db.js forget-customer 98XXXXXXXX');
  const { rowCount } = await pool.query('DELETE FROM customers WHERE phone_key = $1', [key]);
  const o = await pool.query("UPDATE orders SET name = '', phone = '' WHERE right(regexp_replace(phone, '\\D', '', 'g'), 10) = $1", [key]);
  console.log(rowCount ? 'Removed from the customer list.' : 'That number was not on the customer list.', 'Details cleared from ' + o.rowCount + ' order(s).');
}

function askHidden() {
  if (!process.stdin.isTTY) return Promise.reject(new Error('No terminal: run with -it, or pass the passcode as NEW_PASSCODE.'));
  const readline = require('readline');
  const ask = (q) => new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.startsWith(q)) rl.output.write(q); }; // echo the question, not the typing
    rl.question(q, (a) => { rl.close(); process.stdout.write('\n'); resolve(a); });
  });
  return ask('New passcode (10+ characters): ').then((a) => ask('Type it again: ').then((b) => {
    if (a !== b) throw new Error('The two passcodes did not match. Nothing changed.');
    return a;
  }));
}

if (require.main === module) {
  const cmd = process.argv[2];
  (async () => {
    await migrate();
    if (cmd === 'reset') { await reset(); console.log('Database wiped and re-seeded with defaults.'); }
    else if (cmd === 'reset-menu') {
      // Replace only the menu with the one in defaults.js; orders, settings, photos and analytics stay.
      await tx(async (c) => { await c.query('DELETE FROM menu_items'); await insertMenu(c, defaults.MENU); });
      console.log('Menu replaced: ' + defaults.MENU.length + ' items from defaults.js.');
    }
    else if (cmd === 'set-passcode') await setPasscode();
    else if (cmd === 'customers') await exportCustomers();
    else if (cmd === 'forget-customer') await forgetCustomerCli(process.argv[3]);
    else { await seed(); console.log('Database ready.'); }
  })().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => pool.end());
}
