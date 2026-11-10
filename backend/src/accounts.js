/* ==========================================================================
   Dashboard accounts, for the site administrator ("super" role) only:
   add staff, reset a forgotten password, switch an account off, sign people
   out, and a few checks for when something isn't working.
   A new or reset account gets a temporary password, shown once, which its
   owner must replace when they first sign in.
   ========================================================================== */
'use strict';
const crypto = require('crypto');
const { pool } = require('./db');
const { hashPassword } = require('./password');
const { lastBackup, normEmail, sha, myToken, PERMISSIONS } = require('./auth');
const features = require('./features');
const mail = require('./mail');
const { fail: refuse } = require('./validate'); // a 400 with this message

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ROLES = ['staff', 'super'];

// 12 random letters and digits, grouped so it can be read out over the phone: "kq7m-2xfa-9pzt".
function tempPassword() {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789'; // no look-alikes (l/1, o/0, i)
  const pick = () => abc[crypto.randomInt(abc.length)];
  return [0, 1, 2].map(() => pick() + pick() + pick() + pick()).join('-');
}

const PUBLIC = 'id, email, name, role, active, permissions, must_change AS "mustChange", last_login AS "lastLogin", created_at AS "createdAt"';

async function list() {
  const { rows } = await pool.query(`SELECT ${PUBLIC},
    (SELECT count(*)::int FROM admin_sessions s WHERE s.user_id = u.id AND s.expires_at > now()) AS sessions
    FROM admin_users u ORDER BY role DESC, created_at`);
  return rows;
}

async function create(b) {
  const email = normEmail(b.email);
  if (!EMAIL_RE.test(email)) refuse('Enter a valid email address.');
  const role = ROLES.includes(b.role) ? b.role : 'staff';
  const name = String(b.name || '').trim().slice(0, 60);
  const temp = tempPassword();
  try {
    await pool.query('INSERT INTO admin_users (email, name, role, pass_hash, must_change) VALUES ($1, $2, $3, $4, true)', [email, name, role, await hashPassword(temp)]);
  } catch (e) {
    if (e.code === '23505') refuse('There is already an account for ' + email + '.');
    throw e;
  }
  return { tempPassword: temp };
}

async function findUser(id) {
  const { rows } = await pool.query('SELECT id, email, role, active FROM admin_users WHERE id = $1', [Number(id) || 0]);
  return rows[0] || refuse('No such account.');
}
// The site must always keep one working administrator account.
async function keepOneSuper(user) {
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM admin_users WHERE role = 'super' AND active AND id <> $1", [user.id]);
  if (!rows[0].n) refuse('This is the only administrator account. Make another account an administrator first.');
}

async function resetPassword(id) {
  const user = await findUser(id);
  const temp = tempPassword();
  await pool.query('UPDATE admin_users SET pass_hash = $1, must_change = true WHERE id = $2', [await hashPassword(temp), user.id]);
  await pool.query('DELETE FROM admin_sessions WHERE user_id = $1', [user.id]);
  return { tempPassword: temp };
}

async function update(id, b, me) {
  const user = await findUser(id);
  const sets = [], vals = [];
  if (typeof b.name === 'string') { vals.push(b.name.trim().slice(0, 60)); sets.push('name = $' + vals.length); }
  if (b.role !== undefined) {
    if (!ROLES.includes(b.role)) refuse('Unknown role.');
    if (b.role !== 'super' && user.role === 'super') {
      if (user.id === me.id) refuse('You can\'t remove your own administrator role.');
      await keepOneSuper(user);
    }
    vals.push(b.role); sets.push('role = $' + vals.length);
  }
  if (b.active !== undefined) {
    if (!b.active && user.id === me.id) refuse('You can\'t switch off your own account.');
    if (!b.active && user.role === 'super') await keepOneSuper(user);
    vals.push(!!b.active); sets.push('active = $' + vals.length);
    if (!b.active) await pool.query('DELETE FROM admin_sessions WHERE user_id = $1', [user.id]);
  }
  if (b.permissions !== undefined) {
    if (!Array.isArray(b.permissions) || b.permissions.some((p) => !PERMISSIONS.includes(p))) refuse('Unknown part of the dashboard.');
    vals.push([...new Set(b.permissions)]); sets.push('permissions = $' + vals.length);
  }
  if (sets.length) { vals.push(user.id); await pool.query('UPDATE admin_users SET ' + sets.join(', ') + ' WHERE id = $' + vals.length, vals); }
  return (await pool.query(`SELECT ${PUBLIC} FROM admin_users WHERE id = $1`, [user.id])).rows[0];
}

async function signOut(id, req) {
  const user = await findUser(id);
  const { rowCount } = await pool.query('DELETE FROM admin_sessions WHERE user_id = $1 AND token_hash <> $2', [user.id, sha(myToken(req))]);
  return { signedOut: rowCount };
}

async function signOutEveryone(req) {
  const { rowCount } = await pool.query('DELETE FROM admin_sessions WHERE token_hash <> $1', [sha(myToken(req))]);
  return { signedOut: rowCount };
}

/* ---------- Troubleshooting ---------- */
// Sends a test email to your own address and reports exactly what went wrong.
async function testEmail(me) {
  const m = await mail.status();
  if (!m.ready) return { ok: false, error: 'No password saved for ' + m.from + ': add it in Email above.' };
  try {
    await mail.send(me.email, 'Test email from your dashboard', 'This is a test. Sign-in codes will arrive like this.\n');
    return { ok: true, to: me.email };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function diagnostics() {
  const t0 = Date.now();
  const [db, accounts, failed, sessions, orders] = await Promise.all([
    pool.query('SELECT version() AS v'),
    pool.query("SELECT count(*) FILTER (WHERE active)::int AS active, count(*) FILTER (WHERE active AND role = 'super')::int AS supers FROM admin_users"),
    pool.query("SELECT count(*)::int AS n FROM admin_logins WHERE NOT ok AND at > now() - interval '24 hours'"),
    pool.query('SELECT count(*)::int AS n FROM admin_sessions WHERE expires_at > now()'),
    pool.query('SELECT max(created_at) AS last FROM orders')
  ]);
  return {
    email: await mail.status(),
    database: { ok: true, ms: Date.now() - t0, version: db.rows[0].v.split(' ').slice(0, 2).join(' ') },
    accounts: accounts.rows[0],
    signedInNow: sessions.rows[0].n,
    failedSignIns24h: failed.rows[0].n,
    lastOrder: orders.rows[0].last,
    lastBackup: lastBackup() === undefined ? 'not set up' : lastBackup(),
    features: await features.all(),
    server: { node: process.version, uptimeMin: Math.round(process.uptime() / 60), memoryMb: Math.round(process.memoryUsage().rss / 1048576) }
  };
}

module.exports = { list, create, resetPassword, update, signOut, signOutEveryone, testEmail, diagnostics };
