/* ==========================================================================
   Admin auth — scrypt-hashed passcode in Postgres, random session tokens
   in an httpOnly cookie (only a SHA-256 of the token is stored), a per-IP
   lockout against passcode guessing plus an overall cap (many IPs guessing
   together), and a log of sign-ins shown on the dashboard.
   ========================================================================== */
'use strict';
const crypto = require('crypto');
const { pool } = require('./db');
const { hashPasscode, verifyPasscode, weakness, MIN_PASS, MAX_PASS } = require('./passcode');
const { createBucket, clientKey, createGate } = require('./limit');

const TTL_MS = (Number(process.env.SESSION_TTL_HOURS) || 12) * 3600 * 1000;
// Secure cookies by default in production. Set COOKIE_SECURE=false only when
// serving plain HTTP on a private network (never on the public internet).
const SECURE = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : process.env.NODE_ENV === 'production';
// The __Host- prefix makes browsers refuse the cookie unless it is Secure,
// host-only and Path=/, so a subdomain can't plant or overwrite it.
const COOKIE = SECURE ? '__Host-omc_admin' : 'omc_admin';

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i !== -1 && part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch (e) { return null; }
    }
  }
  return null;
}

function setCookie(res, value, maxAgeMs) {
  res.append('Set-Cookie', COOKIE + '=' + encodeURIComponent(value) + '; Path=/; HttpOnly; SameSite=Strict' +
    (SECURE ? '; Secure' : '') + '; Max-Age=' + Math.floor(maxAgeMs / 1000));
}

async function sessionValid(req) {
  const token = readCookie(req, COOKIE);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  const { rows } = await pool.query('SELECT 1 FROM admin_sessions WHERE token_hash = $1 AND expires_at > now()', [sha(token)]);
  return rows.length > 0;
}

async function requireAdmin(req, res, next) {
  if (await sessionValid(req)) return next();
  res.status(401).json({ error: 'Please unlock the dashboard again.' });
}

/* ---------- Brute-force guard: 8 wrong tries per IP → 15 min lockout ---------- */
const MAX_TRIES = 8;
const failures = createBucket(15 * 60 * 1000);
// Across all IPs: past this many wrong tries in 15 minutes, sign-in pauses for
// everyone. Devices that are already signed in keep working.
const MAX_GLOBAL = 60;
const ALL = 'all';

const BUSY = 'Sign-in is paused for a few minutes because of many wrong tries. Devices already signed in keep working.';

// "Chrome on Android" and 203.0.113.x: enough to recognise your own devices, not to track anyone.
function deviceOf(ua) {
  ua = String(ua || '');
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iPhone/iPad' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'unknown system';
  const br = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'a browser';
  return br + ' on ' + os;
}
function maskIp(ip) {
  const v = String(ip || '').replace(/^::ffff:/, '');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v)) return v.replace(/\.\d+$/, '.x');
  return v.includes(':') ? v.split(':').slice(0, 3).join(':') + ':…' : '';
}
async function record(req, ok) {
  await pool.query('INSERT INTO admin_logins (ok, device, ip) VALUES ($1, $2, $3)', [ok, deviceOf(req.headers['user-agent']), maskIp(req.ip)]);
  await pool.query("DELETE FROM admin_logins WHERE at < now() - interval '90 days'");
}

// Whether the default passcode is still in use is only told to a signed-in
// user: to anyone else it would say "the published passcode works here".
async function status(req) {
  const authed = await sessionValid(req);
  if (!authed) return { authed: false };
  const { rows } = await pool.query('SELECT is_default FROM admin_auth WHERE id = 1');
  return { authed: true, defaultPass: !!(rows[0] && rows[0].is_default) };
}

// scrypt is slow and memory-hungry on purpose. Cap how many run at once so a
// flood of guesses from many IPs can't starve the rest of the server.
const hashGate = createGate(2, 40);

async function checkPass(pass) {
  if (typeof pass !== 'string' || !pass || pass.length > MAX_PASS) return false;
  const { rows } = await pool.query('SELECT pass_hash FROM admin_auth WHERE id = 1');
  return rows.length > 0 && hashGate.run(() => verifyPasscode(pass, rows[0].pass_hash));
}

async function login(req, res) {
  if (failures.count(clientKey(req.ip)) >= MAX_TRIES) return res.status(429).json({ error: 'Too many tries. Wait 15 minutes and try again.' });
  if (failures.count(ALL) >= MAX_GLOBAL) return res.status(429).json({ error: BUSY });
  if (!(await checkPass(req.body && req.body.passcode))) {
    failures.hit(clientKey(req.ip), MAX_TRIES);
    failures.hit(ALL, MAX_GLOBAL);
    await record(req, false);
    const left = MAX_TRIES - failures.count(clientKey(req.ip));
    return res.status(401).json({ error: left > 0 && left <= 3 ? 'Wrong passcode. ' + left + (left === 1 ? ' try' : ' tries') + ' left.' : 'Wrong passcode. Try again.' });
  }
  failures.reset(clientKey(req.ip));
  await record(req, true);
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query('DELETE FROM admin_sessions WHERE expires_at < now()');
  await pool.query('INSERT INTO admin_sessions (token_hash, expires_at) VALUES ($1, $2)', [sha(token), new Date(Date.now() + TTL_MS)]);
  setCookie(res, token, TTL_MS);
  res.json({ ok: true });
}

async function logout(req, res) {
  const token = readCookie(req, COOKIE);
  if (token) await pool.query('DELETE FROM admin_sessions WHERE token_hash = $1', [sha(token)]);
  setCookie(res, '', 0);
  res.json({ ok: true });
}

// Needs the current passcode too, so an unlocked, unattended dashboard can't be
// taken over. Changing it signs out every other session.
async function changePasscode(req, res) {
  const b = req.body || {};
  const pass = typeof b.passcode === 'string' ? b.passcode : '';
  const weak = weakness(pass);
  if (weak) return res.status(400).json({ error: 'New passcode: ' + weak });
  if (failures.count(clientKey(req.ip)) >= MAX_TRIES) return res.status(429).json({ error: 'Too many tries. Wait 15 minutes and try again.' });
  if (!(await checkPass(b.current))) {
    failures.hit(clientKey(req.ip), MAX_TRIES);
    return res.status(400).json({ error: 'Current passcode is wrong.' });
  }
  await pool.query('UPDATE admin_auth SET pass_hash = $1, is_default = false, updated_at = now() WHERE id = 1', [await hashPasscode(pass)]);
  await pool.query('DELETE FROM admin_sessions WHERE token_hash <> $1', [sha(readCookie(req, COOKIE) || '')]);
  res.json({ ok: true });
}

// "Sign out all other devices" (a lost phone, a staff member who left).
async function signOutOthers(req, res) {
  const { rowCount } = await pool.query('DELETE FROM admin_sessions WHERE token_hash <> $1', [sha(readCookie(req, COOKIE) || '')]);
  res.json({ ok: true, signedOut: rowCount });
}

// When the backup service last finished (it writes BACKUP_DIR/last-success): null when
// none was found, undefined (left out) when backups aren't set up here at all.
function lastBackup() {
  if (!process.env.BACKUP_DIR) return undefined;
  try {
    const t = require('fs').readFileSync(require('path').join(process.env.BACKUP_DIR, 'last-success'), 'utf8').trim();
    return Number.isNaN(Date.parse(t)) ? null : t;
  } catch (e) { return null; }
}

// For the dashboard: recent sign-ins, wrong tries today, devices signed in now.
async function security(req, res) {
  const [recent, failed, sessions] = await Promise.all([
    pool.query('SELECT at, ok, device, ip FROM admin_logins ORDER BY at DESC LIMIT 10'),
    pool.query("SELECT count(*)::int AS n FROM admin_logins WHERE NOT ok AND at > now() - interval '24 hours'"),
    pool.query('SELECT count(*)::int AS n FROM admin_sessions WHERE expires_at > now()')
  ]);
  res.json({ recent: recent.rows, failed24h: failed.rows[0].n, sessions: sessions.rows[0].n, paused: failures.count(ALL) >= MAX_GLOBAL, lastBackup: lastBackup() });
}

module.exports = { requireAdmin, status, login, logout, changePasscode, signOutOthers, security, MIN_PASS, MAX_PASS };
