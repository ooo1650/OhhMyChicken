/* ==========================================================================
   PostgreSQL connection, schema migration and seeding.
   CLI:  node src/db.js init        → create tables + seed defaults if empty
         node src/db.js reset-menu  → replace only the menu with defaults.js (keeps orders, settings, photos)
         node src/db.js reset       → wipe everything and re-seed defaults
         node src/db.js set-password <email>, add-admin <email> [--super], customers, forget-customer <phone>
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const defaults = require('./defaults');
const { hashPassword, weakness } = require('./password');

// Settings from backend/.env when there is one (hosting without Docker, e.g. a control
// panel's Node.js app). Values set by the host or Docker win; this only fills gaps.
try { process.loadEnvFile(path.join(__dirname, '..', '.env')); } catch (e) { /* no .env file: fine */ }

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
      'INSERT INTO menu_items (id, category, name, diet, description, prices, available, popular, sort_order, image_id, art, no_delivery) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
      [m.id, m.category, m.name, m.diet, m.desc || '', JSON.stringify(m.prices), m.available !== false, !!m.popular, i, m.imageId || null, m.art || '', !!m.noDelivery]
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
    if (!d || d.lat == null || o.lat != null || o.lng != null || o.address !== d.address) return o;
    filled++;
    return { ...o, lat: d.lat, lng: d.lng };
  });
  if (!filled) return;
  await c.query("UPDATE settings SET data = jsonb_set(data, '{outlets}', $1::jsonb) WHERE id = 1", [JSON.stringify(next)]);
  console.log('Added map pins to ' + filled + ' outlet(s).');
}

// The WhatsApp order numbers changed: move databases still on the old ones. A number chosen in the dashboard stays.
const OLD_WHATSAPP = { jhamsikhel: '9779841336695', maharajgunj: '9779860060005', bhaktapur: '9779767319518' };
async function moveOutletWhatsApp(c) {
  const { rows } = await c.query('SELECT data FROM settings WHERE id = 1');
  if (!rows.length) return;
  const data = rows[0].data, outlets = Array.isArray(data.outlets) ? data.outlets : [];
  let moved = 0;
  const next = outlets.map((o) => {
    const d = defaults.SETTINGS.outlets.find((x) => x.id === o.id);
    if (!d || o.whatsapp !== OLD_WHATSAPP[o.id]) return o;
    moved++;
    return { ...o, whatsapp: d.whatsapp };
  });
  const main = data.whatsapp === OLD_WHATSAPP.jhamsikhel;
  if (!moved && !main) return;
  await c.query('UPDATE settings SET data = data || $1::jsonb WHERE id = 1', [JSON.stringify({ outlets: next, whatsapp: main ? defaults.SETTINGS.whatsapp : data.whatsapp })]);
  console.log('Updated WhatsApp numbers on ' + moved + ' outlet(s).');
}

// The Pokhara branch, for databases saved before it opened.
async function addPokhara(c) {
  const { rows } = await c.query('SELECT data FROM settings WHERE id = 1');
  const outlets = rows.length && Array.isArray(rows[0].data.outlets) ? rows[0].data.outlets : [];
  if (!outlets.length || outlets.some((o) => o.id === 'pokhara' || /pokhara/i.test(o.name))) return;
  const pokhara = defaults.SETTINGS.outlets.find((o) => o.id === 'pokhara');
  await c.query("UPDATE settings SET data = jsonb_set(data, '{outlets}', $1::jsonb) WHERE id = 1", [JSON.stringify([...outlets, pokhara])]);
  console.log('Added the Pokhara outlet.');
}

// Counter-made drinks stop being offered for delivery on saved menus.
async function markNoDelivery(c) {
  const ids = defaults.MENU.filter((m) => m.noDelivery).map((m) => m.id);
  await c.query('UPDATE menu_items SET no_delivery = TRUE, updated_at = now() WHERE id = ANY($1)', [ids]);
}

// Delivery became a fee range with no free threshold, and the default hours became 9 to 9 (hours chosen by staff stay).
async function moveDeliveryAndHours(c) {
  const { rows } = await c.query('SELECT data FROM settings WHERE id = 1');
  if (!rows.length) return;
  const d = rows[0].data, S = defaults.SETTINGS;
  const onDefault = d.hoursOpen === '10:00' && d.hoursClose === '22:00';
  const next = { deliveryFeeMin: S.deliveryFeeMin, deliveryFeeMax: S.deliveryFeeMax, ...(onDefault ? { hoursOpen: S.hoursOpen, hoursClose: S.hoursClose } : {}) };
  await c.query("UPDATE settings SET data = (data - 'deliveryFee' - 'freeDeliveryOver') || $1::jsonb WHERE id = 1", [JSON.stringify(next)]);
}

// The site no longer promises a delivery time.
async function dropDeliveryTime(c) {
  await c.query("UPDATE settings SET data = data - 'deliveryMins' WHERE id = 1");
}

// The photo uploaded as "pizatoday": it gets a real description, and comes off the dishes
// using it, which go back to their drawing.
async function fixPizaToday(c) {
  await c.query("UPDATE menu_items SET image_id = NULL, updated_at = now() WHERE image_id IN (SELECT id FROM media WHERE lower(alt) = 'pizatoday')");
  await c.query("UPDATE media SET alt = 'A freshly baked pizza from our oven' WHERE lower(alt) = 'pizatoday'");
}

// Fried chicken joins the crowd favourites on the home page.
async function featureFriedChicken(c) {
  await c.query("UPDATE menu_items SET popular = TRUE, updated_at = now() WHERE id = 'crispy-fried-chicken'");
}

// Customers read where the restaurant really is, not only Kathmandu; and Pokhara's row gets
// a second line like the other branches.
async function addServiceArea(c) {
  const { rows } = await c.query('SELECT data FROM settings WHERE id = 1');
  if (!rows.length) return;
  const outlets = (rows[0].data.outlets || []).map((o) => (o.id === 'pokhara' && o.area === 'Pokhara' ? { ...o, area: 'Kaski' } : o));
  await c.query('UPDATE settings SET data = data || $1::jsonb WHERE id = 1', [JSON.stringify({ serviceArea: rows[0].data.serviceArea || defaults.SETTINGS.serviceArea, outlets })]);
}

// Tuna is fish, so it moves out of Chicken Pizza; and the delivery note reaches saved settings.
async function moveTunaAddNote(c) {
  await c.query("UPDATE menu_items SET category = 'fish', updated_at = now() WHERE id = 'tuna-pizza' AND category = 'nonveg'");
  await c.query("UPDATE settings SET data = jsonb_build_object('deliveryNote', $1::text) || data WHERE id = 1", [defaults.SETTINGS.deliveryNote]);
}

// A Brevo sender saved on 587 or 465 moves to 2525, which hosts like Render don't block.
async function brevoPort(c) {
  await c.query("UPDATE mail_settings SET port = 2525, updated_at = now() WHERE host = 'smtp-relay.brevo.com' AND port IN (465, 587)");
}

// Runs a change to saved data once ever, so what staff later change in the dashboard is left alone.
async function once(c, id, change) {
  const { rowCount } = await c.query('INSERT INTO data_changes (id) VALUES ($1) ON CONFLICT (id) DO NOTHING', [id]);
  if (rowCount) await change(c);
}

// The first dashboard account: the site administrator (PaperKite unless SUPER_ADMIN_EMAIL says otherwise). Its password is
// the shared passcode the dashboard used before accounts existed (so nobody is locked out by an
// upgrade), or else ADMIN_PASSCODE. Once an administrator exists, neither setting is used again.
async function firstAdministrator(c) {
  const { rows } = await c.query("SELECT count(*)::int AS n FROM admin_users WHERE role = 'super' AND active");
  if (rows[0].n) return;
  const email = String(process.env.SUPER_ADMIN_EMAIL || 'paperkite.contact@gmail.com').trim().toLowerCase();
  const old = await c.query('SELECT pass_hash FROM admin_auth WHERE id = 1');
  let hash = old.rows.length ? old.rows[0].pass_hash : '';
  const envPass = process.env.ADMIN_PASSCODE || '';
  if (!hash && envPass) {
    const weak = weakness(envPass);
    if (weak) throw new Error('ADMIN_PASSCODE is too weak: ' + weak);
    hash = await hashPassword(envPass);
  }
  if (!hash) {
    console.warn('No dashboard account yet: set ADMIN_PASSCODE (the first password for ' + email + '), or run: node src/db.js add-admin ' + email + ' --super');
    return;
  }
  await c.query(`INSERT INTO admin_users (email, name, role, pass_hash) VALUES ($1, 'Site administrator', 'super', $2)
    ON CONFLICT (email) DO UPDATE SET role = 'super', active = true`, [email, hash]);
  console.log('Dashboard administrator account created for ' + email + '.');
}

async function seed() {
  await tx(async (c) => {
    const { rows } = await c.query('SELECT count(*)::int AS n FROM menu_items');
    if (!rows[0].n) await insertMenu(c, defaults.MENU);
    await c.query('INSERT INTO settings (id, data) VALUES (1, $1) ON CONFLICT (id) DO NOTHING', [JSON.stringify(defaults.SETTINGS)]);
    await backfillOutletPins(c);
    await once(c, 'outlet-whatsapp-numbers', moveOutletWhatsApp);
    await once(c, 'pokhara-outlet', addPokhara);
    await once(c, 'counter-drinks-no-delivery', markNoDelivery);
    await once(c, 'delivery-range-and-hours', moveDeliveryAndHours);
    await once(c, 'no-delivery-time', dropDeliveryTime);
    await once(c, 'photo-pizatoday', fixPizaToday);
    await once(c, 'feature-fried-chicken', featureFriedChicken);
    await once(c, 'service-area', addServiceArea);
    await once(c, 'fish-category-delivery-note', moveTunaAddNote);
    await once(c, 'brevo-port-2525', brevoPort);
    // The restaurant's full name replaces the old default (a name chosen in the dashboard stays).
    await c.query("UPDATE settings SET data = jsonb_set(data, '{name}', to_jsonb($1::text)) WHERE data->>'name' = 'Ohh My Chicken!'", [defaults.SETTINGS.name]);
    await firstAdministrator(c);
  });
}

async function reset() {
  await pool.query('TRUNCATE menu_items, settings, admin_auth, admin_users, admin_challenges, admin_sessions, admin_logins, orders, customers, events, analytics_salt RESTART IDENTITY');
  await seed();
}

module.exports = { pool, tx, migrate, seed, insertMenu };

// For whoever runs the server, when the dashboard can't be used to fix it:
//   docker compose exec backend node src/db.js set-password owner@example.com
//     a new password for an account (also switches it back on and signs it out everywhere);
//   docker compose exec backend node src/db.js add-admin owner@example.com [--super]
//     a new account (--super: the site administrator, who manages the others).
// Both ask for the password (typing stays hidden). Without a terminal, set NEW_PASSWORD.
async function askPassword() {
  const pass = process.env.NEW_PASSWORD || await askHidden();
  const weak = weakness(pass);
  if (weak) throw new Error('Nothing changed. ' + weak);
  return hashPassword(pass);
}
const emailArg = () => {
  const email = String(process.argv[3] || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Give the email address, e.g. node src/db.js ' + process.argv[2] + ' owner@example.com');
  return email;
};

async function setPassword() {
  const email = emailArg(), hash = await askPassword();
  const { rows } = await pool.query('UPDATE admin_users SET pass_hash = $1, must_change = false, active = true WHERE email = $2 RETURNING id', [hash, email]);
  if (!rows.length) throw new Error('No account for ' + email + '. Create it with: node src/db.js add-admin ' + email);
  await pool.query('DELETE FROM admin_sessions WHERE user_id = $1', [rows[0].id]);
  console.log('Password changed for ' + email + '. It is signed out everywhere; sign in with the new password.');
}

async function addAdmin() {
  const email = emailArg(), role = process.argv.includes('--super') ? 'super' : 'staff', hash = await askPassword();
  const { rowCount } = await pool.query('INSERT INTO admin_users (email, role, pass_hash) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING', [email, role, hash]);
  if (!rowCount) throw new Error('There is already an account for ' + email + '. To change its password: node src/db.js set-password ' + email);
  console.log((role === 'super' ? 'Administrator' : 'Staff') + ' account created for ' + email + '.');
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
  if (!process.stdin.isTTY) return Promise.reject(new Error('No terminal: run with -it, or pass the password as NEW_PASSWORD.'));
  const readline = require('readline');
  const ask = (q) => new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.startsWith(q)) rl.output.write(q); }; // echo the question, not the typing
    rl.question(q, (a) => { rl.close(); process.stdout.write('\n'); resolve(a); });
  });
  return ask('New password (10+ characters): ').then((a) => ask('Type it again: ').then((b) => {
    if (a !== b) throw new Error('The two passwords did not match. Nothing changed.');
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
    else if (cmd === 'set-password') await setPassword();
    else if (cmd === 'add-admin') await addAdmin();
    else if (cmd === 'customers') await exportCustomers();
    else if (cmd === 'forget-customer') await forgetCustomerCli(process.argv[3]);
    else { await seed(); console.log('Database ready.'); }
  })().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => pool.end());
}
