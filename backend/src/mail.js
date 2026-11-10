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

// Only ever emails dashboard accounts that are switched on: never an address typed into a
// form, so no one can use the site to send mail (or bounces) to strangers.
async function send(to, subject, text) {
  const { rows } = await pool.query('SELECT 1 FROM admin_users WHERE email = $1 AND active', [String(to).toLowerCase()]);
  if (!rows.length) throw new Error('not sent: ' + to + ' is not a dashboard account');
  const c = await config();
  if (!c.pass) throw new Error('no password saved for ' + c.from + ' (Team → Email)');
  await mailer(c).sendMail({ from: c.from, to, subject, text });
}

// For the Team tab: everything except the password itself.
async function status() {
  const c = await config();
  return { from: c.from, host: c.host, port: c.port, user: c.user === c.from ? '' : c.user, hasPassword: !!c.pass, ready: !!(c.from && c.host && c.pass), source: c.source };
}

const { email: validEmail, str } = require('./validate');
const HOST_RE = /^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/i;

// Saves the sender. A blank password keeps the saved one.
async function save(b, fail) {
  const from = validEmail(b.from, 'Sender email');
  const host = str(b.host || DEFAULT_HOST, 253, 'Email server').toLowerCase();
  if (!HOST_RE.test(host)) fail('Enter the email server, e.g. smtp-relay.brevo.com.');
  const port = Number(b.port) || DEFAULT_PORT;
  if (![25, 465, 587, 2525].includes(port)) fail('The email port is usually 587 or 465.');
  const user = str(b.user, 254, 'Login');
  if (/\s/.test(user)) fail('The login has no spaces.');
  if (BREVO.test(host) && !user) fail('Enter your Brevo SMTP login (Brevo → SMTP & API → SMTP). It is not the sender address.');
  if (b.password != null && typeof b.password !== 'string') fail('The password must be text.');
  const pass = (b.password || '').replace(/\s+/g, ''); // Gmail shows app passwords with spaces
  if (pass.length > 200 || !/^[\x21-\x7e]*$/.test(pass)) fail('That password has characters an email service would not give out.');
  // A saved password belongs to the login it was saved for: changing the login drops it.
  const current = await config(), keep = (user || from) === current.user ? current.pass : '';
  await pool.query(
    `INSERT INTO mail_settings (id, sender, host, port, username, password) VALUES (1, $1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET sender = $1, host = $2, port = $3, username = $4, password = $5, updated_at = now()`,
    [from, host, port, user, pass || keep]);
  return status();
}

module.exports = { send, status, save };
