/* ==========================================================================
   Admin auth — scrypt-hashed passcode in Postgres, random session tokens
   in an httpOnly cookie (only a SHA-256 of the token is stored), and a
   per-IP lockout against passcode guessing.
   ========================================================================== */
'use strict';
const crypto = require('crypto');
const { pool } = require('./db');
const { hashPasscode, verifyPasscode } = require('./passcode');
const { createBucket } = require('./limit');

const TTL_MS = (Number(process.env.SESSION_TTL_HOURS) || 12) * 3600 * 1000;
// Secure cookies by default in production. Set COOKIE_SECURE=false only when
// serving plain HTTP on a private network (never on the public internet).
const SECURE = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : process.env.NODE_ENV === 'production';
// The __Host- prefix makes browsers refuse the cookie unless it is Secure,
// host-only and Path=/, so a subdomain can't plant or overwrite it.
const COOKIE = SECURE ? '__Host-omc_admin' : 'omc_admin';
const MIN_PASS = 8, MAX_PASS = 128;

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

// Whether the default passcode is still in use is only told to a signed-in
// user: to anyone else it would say "the published passcode works here".
async function status(req) {
  const authed = await sessionValid(req);
  if (!authed) return { authed: false };
  const { rows } = await pool.query('SELECT is_default FROM admin_auth WHERE id = 1');
  return { authed: true, defaultPass: !!(rows[0] && rows[0].is_default) };
}

async function checkPass(pass) {
  const { rows } = await pool.query('SELECT pass_hash FROM admin_auth WHERE id = 1');
  return rows.length > 0 && typeof pass === 'string' && pass.length <= MAX_PASS && verifyPasscode(pass, rows[0].pass_hash);
}

async function login(req, res) {
  if (failures.count(req.ip) >= MAX_TRIES) return res.status(429).json({ error: 'Too many tries. Wait 15 minutes and try again.' });
  if (!(await checkPass(req.body && req.body.passcode))) {
    failures.hit(req.ip, MAX_TRIES);
    const left = MAX_TRIES - failures.count(req.ip);
    return res.status(401).json({ error: left > 0 && left <= 3 ? 'Wrong passcode. ' + left + (left === 1 ? ' try' : ' tries') + ' left.' : 'Wrong passcode. Try again.' });
  }
  failures.reset(req.ip);
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
  if (pass.length < MIN_PASS || pass.length > MAX_PASS) return res.status(400).json({ error: 'New passcode must be at least ' + MIN_PASS + ' characters.' });
  if (failures.count(req.ip) >= MAX_TRIES) return res.status(429).json({ error: 'Too many tries. Wait 15 minutes and try again.' });
  if (!(await checkPass(b.current))) {
    failures.hit(req.ip, MAX_TRIES);
    return res.status(400).json({ error: 'Current passcode is wrong.' });
  }
  await pool.query('UPDATE admin_auth SET pass_hash = $1, is_default = false, updated_at = now() WHERE id = 1', [await hashPasscode(pass)]);
  await pool.query('DELETE FROM admin_sessions WHERE token_hash <> $1', [sha(readCookie(req, COOKIE) || '')]);
  res.json({ ok: true });
}

module.exports = { requireAdmin, status, login, logout, changePasscode, MIN_PASS };
