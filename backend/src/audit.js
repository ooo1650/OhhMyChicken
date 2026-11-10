/* Who changed what in the administrator's areas, for Team → Recent changes.
   Details are short descriptions written here, never passwords, keys or codes. Kept a year. */
'use strict';
const { pool } = require('./db');

async function record(req, action, detail) {
  await pool.query('INSERT INTO admin_audit (actor, action, detail) VALUES ($1, $2, $3)', [req.user ? req.user.email : 'server', action, String(detail || '').slice(0, 300)]);
  await pool.query("DELETE FROM admin_audit WHERE at < now() - interval '365 days'");
}

async function recent(limit = 30) {
  const { rows } = await pool.query('SELECT at, actor, action, detail FROM admin_audit ORDER BY at DESC, id DESC LIMIT $1', [limit]);
  return rows;
}

module.exports = { record, recent };
