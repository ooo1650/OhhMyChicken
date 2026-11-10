/* ==========================================================================
   Email for dashboard sign-in codes, over SMTP: Brevo (the default), Gmail
   with an app password, or any other service. The site administrator sets
   the sender in Team → Email; until then the SMTP_* / MAIL_FROM settings in
   .env apply, and failing those, the defaults below.
   ========================================================================== */
'use strict';
const nodemailer = require('nodemailer');
const { pool } = require('./db');

const DEFAULT_SENDER = 'paperkite.contact@gmail.com';
const DEFAULT_HOST = 'smtp-relay.brevo.com', DEFAULT_PORT = 587;
const BREVO = /(^|\.)brevo\.com$|sendinblue\.com$/;
const env = process.env;

// The settings in use: the dashboard's, else .env, else the defaults.
async function config() {
  const { rows } = await pool.query('SELECT sender, host, port, username, password FROM mail_settings WHERE id = 1');
  const saved = rows[0];
  if (saved) return { from: saved.sender, host: saved.host, port: saved.port, user: saved.username || saved.sender, pass: saved.password, source: 'dashboard' };
  const from = env.MAIL_FROM || env.SMTP_USER || DEFAULT_SENDER;
  return { from, host: env.SMTP_HOST || DEFAULT_HOST, port: Number(env.SMTP_PORT) || DEFAULT_PORT, user: env.SMTP_USER || from, pass: env.SMTP_PASS || '', source: env.SMTP_HOST ? 'server settings' : 'default' };
}

// One connection setup per distinct configuration.
let transport = null, transportKey = '';
function mailer(c) {
  const key = JSON.stringify([c.host, c.port, c.user, c.pass]);
  if (key !== transportKey) {
    transport = nodemailer.createTransport({
      // 465 is encrypted from the start; on 587 and others the connection must switch to TLS
      // before the password is sent, or nothing is sent at all.
      host: c.host, port: c.port, secure: c.port === 465, requireTLS: c.port !== 465,
      auth: c.pass ? { user: c.user, pass: c.pass } : undefined,
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000
    });
    transportKey = key;
  }
  return transport;
}

async function send(to, subject, text) {
  const c = await config();
  if (!c.pass) throw new Error('no password saved for ' + c.from + ' (Team → Email)');
  await mailer(c).sendMail({ from: c.from, to, subject, text });
}

// For the Team tab: everything except the password itself.
async function status() {
  const c = await config();
  return { from: c.from, host: c.host, port: c.port, user: c.user === c.from ? '' : c.user, hasPassword: !!c.pass, ready: !!(c.from && c.host && c.pass), source: c.source };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const HOST_RE = /^[a-z0-9.-]{1,253}$/i;

// Saves the sender. A blank password keeps the saved one.
async function save(b, fail) {
  const from = String(b.from || '').trim().toLowerCase();
  if (!EMAIL_RE.test(from)) fail('Enter the sender\'s email address.');
  const host = String(b.host || DEFAULT_HOST).trim().toLowerCase();
  if (!HOST_RE.test(host)) fail('Enter the email server, e.g. smtp-relay.brevo.com.');
  const port = Number(b.port) || DEFAULT_PORT;
  if (![25, 465, 587, 2525].includes(port)) fail('The email port is usually 587 or 465.');
  const user = String(b.user || '').trim().slice(0, 254);
  if (BREVO.test(host) && !user) fail('Enter your Brevo SMTP login (Brevo → SMTP & API → SMTP). It is not the sender address.');
  const pass = typeof b.password === 'string' ? b.password.replace(/\s+/g, '') : ''; // Gmail shows app passwords with spaces
  if (pass.length > 200) fail('That password is too long.');
  // A saved password belongs to the login it was saved for: changing the login drops it.
  const current = await config(), keep = (user || from) === current.user ? current.pass : '';
  await pool.query(
    `INSERT INTO mail_settings (id, sender, host, port, username, password) VALUES (1, $1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET sender = $1, host = $2, port = $3, username = $4, password = $5, updated_at = now()`,
    [from, host, port, user, pass || keep]);
  return status();
}

module.exports = { send, status, save };
