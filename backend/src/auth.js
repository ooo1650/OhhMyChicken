/* ==========================================================================
   Dashboard sign-in, in two steps:
     1. email + password (scrypt hash in admin_users), then
     2. a 6-digit code sent to that email, valid for 10 minutes and 5 tries.
   A session is a random token in an httpOnly cookie (only its SHA-256 is
   stored) that lasts one hour from sign-in. Wrong tries are limited per IP,
   per account and overall, and every sign-in is logged. Codes are emailed only
   to active accounts, after the right password, at most 10 an hour each.
   Forgot password: a code to the account's email sets a new password; the
   answer is the same whether or not the email has an account.
   ========================================================================== */
'use strict';
const crypto = require('crypto');
const { pool } = require('./db');
const { hashPassword, verifyPassword, weakness, MAX_PASS } = require('./password');
const { createBucket, clientKey, createGate } = require('./limit');
const mail = require('./mail');
const emails = require('./emails');

const TTL_MS = 60 * 60 * 1000;   // a sign-in lasts one hour, however much the dashboard is used
const CODE_MS = 10 * 60 * 1000;  // an emailed code works for 10 minutes…
const CODE_TRIES = 5;            // …and for 5 tries
const RESEND_MS = 60 * 1000;     // a new code at most once a minute
const CODES_PER_HOUR = Number(process.env.CODE_LIMIT) || 10; // emails per account per hour (tests raise it)

// Secure cookies by default in production. Set COOKIE_SECURE=false only when
// serving plain HTTP on a private network (never on the public internet).
const SECURE = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : process.env.NODE_ENV === 'production';
// The __Host- prefix makes browsers refuse the cookie unless it is Secure,
// host-only and Path=/, so a subdomain can't plant or overwrite it.
const COOKIE = SECURE ? '__Host-omc_admin' : 'omc_admin';

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const normEmail = (e) => (typeof e === 'string' ? e.trim().toLowerCase().slice(0, 254) : '');
const isToken = (t) => typeof t === 'string' && /^[a-f0-9]{64}$/.test(t);
// "s•••@gmail.com": enough to recognise your own address on the code screen.
const maskEmail = (e) => e.replace(/^(.)[^@]*/, (m, first) => first + '•••');

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
const myToken = (req) => readCookie(req, COOKIE) || '';

function setCookie(res, value, maxAgeMs) {
  res.append('Set-Cookie', COOKIE + '=' + encodeURIComponent(value) + '; Path=/; HttpOnly; SameSite=Strict' +
    (SECURE ? '; Secure' : '') + '; Max-Age=' + Math.floor(maxAgeMs / 1000));
}

/* ---------- Who is signed in ---------- */
// The account behind this request's session, with the time left; null without a valid one.
async function currentUser(req) {
  const token = myToken(req);
  if (!isToken(token)) return null;
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.name, u.role, u.must_change, u.permissions, EXTRACT(EPOCH FROM s.expires_at - now()) * 1000 AS left_ms
     FROM admin_sessions s JOIN admin_users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now() AND u.active`, [sha(token)]);
  if (!rows.length) return null;
  const u = rows[0];
  // The administrator can use every part of the dashboard, whatever is stored.
  const permissions = u.role === 'super' ? PERMISSIONS.slice() : u.permissions.filter((p) => PERMISSIONS.includes(p));
  return { id: u.id, email: u.email, name: u.name, role: u.role, mustChange: u.must_change, permissions, leftMs: Math.ceil(Number(u.left_ms)) };
}

// Any signed-in account: only for the session, sign-out and choosing a new password.
async function signedIn(req, res, next) {
  req.user = await currentUser(req);
  if (req.user) return next();
  res.status(401).json({ error: 'Please sign in again.' });
}
// Everything else in the dashboard. A temporary password must be replaced first.
function requireAdmin(req, res, next) {
  signedIn(req, res, () => {
    if (req.user.mustChange) return res.status(403).json({ error: 'Choose a new password first.' });
    next();
  });
}
// One part of the dashboard (or any of several), as allowed in Team → Accounts.
const PERMISSIONS = ['menu', 'orders', 'photos', 'outlets', 'store', 'qr', 'insights'];
const can = (...parts) => (req, res, next) => requireAdmin(req, res, () => {
  if (parts.some((p) => req.user.permissions.includes(p))) return next();
  res.status(403).json({ error: 'Your account can\'t use this part of the dashboard. Ask the site administrator.' });
});

// Account management and troubleshooting.
function requireSuper(req, res, next) {
  requireAdmin(req, res, () => {
    if (req.user.role !== 'super') return res.status(403).json({ error: 'Only the site administrator can do that.' });
    next();
  });
}

async function status(req) {
  const u = await currentUser(req);
  if (!u) return { authed: false };
  return { authed: true, user: { email: u.email, name: u.name, role: u.role, mustChange: u.mustChange, permissions: u.permissions }, expiresInMs: u.leftMs };
}

// Sessions from before the one-hour limit (or a longer setting) don't get to outlive it.
async function capSessions() {
  await pool.query('UPDATE admin_sessions SET expires_at = now() + make_interval(secs => $1) WHERE expires_at > now() + make_interval(secs => $1)', [TTL_MS / 1000]);
}

/* ---------- Guessing limits ---------- */
// 8 wrong tries per IP, or 10 against one account, lock that out for 15 minutes. Past 60
// wrong tries in 15 minutes from anywhere, sign-in pauses for everyone (signed-in devices keep working).
const MAX_TRIES = 8, MAX_ACCOUNT = 10, MAX_GLOBAL = 60, ALL = 'all';
const failures = createBucket(15 * 60 * 1000);
// Codes emailed per account, so a known password can't be used to flood an inbox.
const codesSent = createBucket(60 * 60 * 1000);
const TOO_MANY_CODES = 'Too many codes were sent to this email in the last hour. Wait a while, or ask the site administrator.';
const BUSY = 'Sign-in is paused for a few minutes because of many wrong tries. Devices already signed in keep working.';
const TOO_MANY = 'Too many tries. Wait 15 minutes and try again.';

function blocked(req, email) {
  if (failures.count(clientKey(req.ip)) >= MAX_TRIES) return TOO_MANY;
  if (email && failures.count('acct:' + email) >= MAX_ACCOUNT) return TOO_MANY;
  if (failures.count(ALL) >= MAX_GLOBAL) return BUSY;
  return '';
}
function countFailure(req, email) {
  failures.hit(clientKey(req.ip), MAX_TRIES);
  if (email) failures.hit('acct:' + email, MAX_ACCOUNT);
  failures.hit(ALL, MAX_GLOBAL);
}

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
async function record(req, ok, email) {
  await pool.query('INSERT INTO admin_logins (ok, device, ip, email) VALUES ($1, $2, $3, $4)', [ok, deviceOf(req.headers['user-agent']), maskIp(req.ip), email || '']);
  await pool.query("DELETE FROM admin_logins WHERE at < now() - interval '90 days'");
}

// scrypt is slow and memory-hungry on purpose. Cap how many run at once so a
// flood of guesses from many IPs can't starve the rest of the server.
const hashGate = createGate(2, 40);
// Checked against when the email is unknown, so a wrong email takes as long as a wrong password.
let decoy = null;

async function passwordMatches(user, pass) {
  if (typeof pass !== 'string' || !pass || pass.length > MAX_PASS) return false;
  if (!user) {
    decoy = decoy || await hashPassword(crypto.randomBytes(16).toString('hex'));
    await hashGate.run(() => verifyPassword(pass, decoy));
    return false;
  }
  return hashGate.run(() => verifyPassword(pass, user.pass_hash));
}

/* ---------- Step 1: password, then a code by email ---------- */
const newCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');
const codeHash = (token, code) => sha(token + ':' + code);

// Emails the code (designs in emails.js), saying which device asked for it. If sending
// fails, the code goes to the server log instead, so whoever runs the server can still get
// in (they can read the database anyway).
async function sendCode(email, code, purpose, req) {
  const where = { device: deviceOf(req.headers['user-agent']), ip: maskIp(req.ip) };
  try {
    await mail.send(email, purpose === 'reset' ? emails.resetCode(code, where) : emails.signInCode(code, where));
    return true;
  } catch (e) {
    console.warn((purpose === 'reset' ? 'Password reset code' : 'Sign-in code') + ' for ' + email + ': ' + code + ' (not emailed: ' + e.message + ')');
    return false;
  }
}

async function login(req, res) {
  const b = req.body || {};
  const email = normEmail(b.email);
  const stop = blocked(req, email);
  if (stop) return res.status(429).json({ error: stop });
  const { rows } = await pool.query('SELECT id, email, pass_hash FROM admin_users WHERE email = $1 AND active', [email]);
  if (!(await passwordMatches(rows[0], b.password))) {
    countFailure(req, email);
    await record(req, false, email);
    return res.status(401).json({ error: 'Wrong email or password.' });
  }
  if (codesSent.count(email) >= CODES_PER_HOUR) return res.status(429).json({ error: TOO_MANY_CODES });
  codesSent.hit(email, CODES_PER_HOUR);
  const token = crypto.randomBytes(32).toString('hex'), code = newCode();
  await pool.query('DELETE FROM admin_challenges WHERE expires_at < now()');
  await pool.query('INSERT INTO admin_challenges (token_hash, user_id, code_hash, expires_at) VALUES ($1, $2, $3, $4)',
    [sha(token), rows[0].id, codeHash(token, code), new Date(Date.now() + CODE_MS)]);
  const emailed = await sendCode(email, code, 'login', req);
  res.json({ challenge: token, sentTo: maskEmail(email), emailed });
}

async function findChallenge(token, purpose = 'login') {
  if (!isToken(token)) return null;
  const { rows } = await pool.query(
    `SELECT c.token_hash, c.code_hash, c.tries, c.sent_at, u.id AS user_id, u.email
     FROM admin_challenges c JOIN admin_users u ON u.id = c.user_id
     WHERE c.token_hash = $1 AND c.purpose = $2 AND c.expires_at > now() AND u.active`, [sha(token), purpose]);
  return rows[0] || null;
}
const EXPIRED = 'That code has expired. Sign in again to get a new one.';

/* ---------- Step 2: the code ---------- */
async function verify(req, res) {
  const b = req.body || {};
  const stop = blocked(req);
  if (stop) return res.status(429).json({ error: stop });
  const ch = await findChallenge(b.challenge);
  if (!ch || ch.tries >= CODE_TRIES) return res.status(400).json({ error: EXPIRED, expired: true });
  const code = String(b.code || '').replace(/\D/g, '');
  const right = code.length === 6 && crypto.timingSafeEqual(Buffer.from(codeHash(b.challenge, code)), Buffer.from(ch.code_hash));
  if (!right) {
    countFailure(req, ch.email);
    await record(req, false, ch.email);
    const left = CODE_TRIES - ch.tries - 1;
    if (left <= 0) {
      await pool.query('DELETE FROM admin_challenges WHERE token_hash = $1', [ch.token_hash]);
      return res.status(400).json({ error: 'Too many wrong codes. Sign in again to get a new one.', expired: true });
    }
    await pool.query('UPDATE admin_challenges SET tries = tries + 1 WHERE token_hash = $1', [ch.token_hash]);
    return res.status(401).json({ error: 'Wrong code. ' + left + (left === 1 ? ' try' : ' tries') + ' left.' });
  }
  failures.reset(clientKey(req.ip));
  failures.reset('acct:' + ch.email);
  await pool.query('DELETE FROM admin_challenges WHERE token_hash = $1', [ch.token_hash]);
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query('DELETE FROM admin_sessions WHERE expires_at < now()');
  await pool.query('INSERT INTO admin_sessions (token_hash, expires_at, user_id) VALUES ($1, $2, $3)', [sha(token), new Date(Date.now() + TTL_MS), ch.user_id]);
  await pool.query('UPDATE admin_users SET last_login = now() WHERE id = $1', [ch.user_id]);
  await record(req, true, ch.email);
  setCookie(res, token, TTL_MS);
  res.json({ ok: true });
}

async function resend(req, res) {
  const ch = await findChallenge((req.body || {}).challenge);
  if (!ch) return res.status(400).json({ error: EXPIRED, expired: true });
  if (Date.now() - new Date(ch.sent_at).getTime() < RESEND_MS) return res.status(429).json({ error: 'Wait a minute before asking for another code.' });
  if (codesSent.count(ch.email) >= CODES_PER_HOUR) return res.status(429).json({ error: TOO_MANY_CODES });
  codesSent.hit(ch.email, CODES_PER_HOUR);
  const code = newCode();
  await pool.query('UPDATE admin_challenges SET code_hash = $1, tries = 0, sent_at = now(), expires_at = $2 WHERE token_hash = $3',
    [codeHash(req.body.challenge, code), new Date(Date.now() + CODE_MS), ch.token_hash]);
  res.json({ emailed: await sendCode(ch.email, code, 'login', req) });
}

/* ---------- Forgot password: a code by email, then a new password ---------- */
// The answer looks the same whether or not the email has an account, so this can't be
// used to find out who works here. Only a real, active account is ever emailed.
async function forgot(req, res) {
  const email = normEmail((req.body || {}).email);
  const stop = blocked(req, email);
  if (stop) return res.status(429).json({ error: stop });
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter your email address.' });
  const token = crypto.randomBytes(32).toString('hex');
  const { rows } = await pool.query('SELECT id FROM admin_users WHERE email = $1 AND active', [email]);
  if (rows.length && codesSent.count(email) < CODES_PER_HOUR) {
    codesSent.hit(email, CODES_PER_HOUR);
    const code = newCode();
    await pool.query('DELETE FROM admin_challenges WHERE expires_at < now()');
    await pool.query("INSERT INTO admin_challenges (token_hash, user_id, code_hash, expires_at, purpose) VALUES ($1, $2, $3, $4, 'reset')",
      [sha(token), rows[0].id, codeHash(token, code), new Date(Date.now() + CODE_MS)]);
    await sendCode(email, code, 'reset', req);
  }
  res.json({ challenge: token, sentTo: maskEmail(email) });
}

const RESET_FAILED = 'That code is wrong or has expired. Ask for a new one.';
async function resetPassword(req, res) {
  const b = req.body || {};
  const stop = blocked(req);
  if (stop) return res.status(429).json({ error: stop });
  const weak = weakness(b.password);
  if (weak) return res.status(400).json({ error: 'New password: ' + weak });
  const ch = await findChallenge(b.challenge, 'reset');
  const code = String(b.code || '').replace(/\D/g, '');
  const right = ch && ch.tries < CODE_TRIES && code.length === 6 &&
    crypto.timingSafeEqual(Buffer.from(codeHash(b.challenge, code)), Buffer.from(ch.code_hash));
  if (!right) {
    countFailure(req, ch && ch.email);
    if (ch) await pool.query('UPDATE admin_challenges SET tries = tries + 1 WHERE token_hash = $1', [ch.token_hash]);
    return res.status(400).json({ error: RESET_FAILED });
  }
  await pool.query('DELETE FROM admin_challenges WHERE token_hash = $1', [ch.token_hash]);
  await pool.query('UPDATE admin_users SET pass_hash = $1, must_change = false WHERE id = $2', [await hashPassword(b.password), ch.user_id]);
  await pool.query('DELETE FROM admin_sessions WHERE user_id = $1', [ch.user_id]); // every device signs in again
  await pool.query("INSERT INTO admin_audit (actor, action, detail) VALUES ($1, 'password.forgot', 'new password set with an emailed code')", [ch.email]);
  res.json({ ok: true });
}

async function logout(req, res) {
  const token = myToken(req);
  if (token) await pool.query('DELETE FROM admin_sessions WHERE token_hash = $1', [sha(token)]);
  setCookie(res, '', 0);
  res.json({ ok: true });
}

/* ---------- Your own account ---------- */
// Needs the current password too, so an unlocked, unattended dashboard can't be taken
// over. Signs out your other devices.
async function changePassword(req, res) {
  const b = req.body || {};
  const weak = weakness(b.password);
  if (weak) return res.status(400).json({ error: 'New password: ' + weak });
  const stop = blocked(req, req.user.email);
  if (stop) return res.status(429).json({ error: stop });
  const { rows } = await pool.query('SELECT pass_hash FROM admin_users WHERE id = $1', [req.user.id]);
  if (!(await passwordMatches(rows[0], b.current))) {
    countFailure(req, req.user.email);
    return res.status(400).json({ error: 'Current password is wrong.' });
  }
  if (b.current === b.password) return res.status(400).json({ error: 'Choose a password different from the current one.' });
  await pool.query('UPDATE admin_users SET pass_hash = $1, must_change = false WHERE id = $2', [await hashPassword(b.password), req.user.id]);
  await pool.query('DELETE FROM admin_sessions WHERE user_id = $1 AND token_hash <> $2', [req.user.id, sha(myToken(req))]);
  res.json({ ok: true });
}

// "Sign out my other devices" (a lost phone, a forgotten laptop).
async function signOutOthers(req, res) {
  const { rowCount } = await pool.query('DELETE FROM admin_sessions WHERE user_id = $1 AND token_hash <> $2', [req.user.id, sha(myToken(req))]);
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

// Your devices signed in now. The site administrator (the web provider) also gets the
// sign-in log, wrong tries and backups; restaurant accounts don't, that's the provider's job.
async function security(req, res) {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM admin_sessions WHERE expires_at > now() AND user_id = $1', [req.user.id]);
  if (req.user.role !== 'super') return res.json({ sessions: rows[0].n });
  const [recent, failed] = await Promise.all([
    pool.query('SELECT at, ok, device, ip, email FROM admin_logins ORDER BY at DESC LIMIT 10'),
    pool.query("SELECT count(*)::int AS n FROM admin_logins WHERE NOT ok AND at > now() - interval '24 hours'")
  ]);
  res.json({ recent: recent.rows, failed24h: failed.rows[0].n, sessions: rows[0].n, paused: failures.count(ALL) >= MAX_GLOBAL, lastBackup: lastBackup() });
}

module.exports = {
  PERMISSIONS, can, capSessions, signedIn, requireAdmin, requireSuper, status, login, verify, resend, forgot, resetPassword, logout,
  changePassword, signOutOthers, security, lastBackup, sha, myToken
};
