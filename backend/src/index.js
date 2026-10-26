/* ==========================================================================
   Ohh My Chicken! — Express JSON API. The React frontend is a separate
   service; its server proxies /api here, so browsers see one origin.
   ========================================================================== */
'use strict';
const express = require('express');
const helmet = require('helmet');
const db = require('./db');
const routes = require('./routes');
const { limit } = require('./limit');
const media = require('./media');

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const PROD = process.env.NODE_ENV === 'production';

app.disable('x-powered-by');
// Behind the frontend server (or any proxy) set TRUST_PROXY=1 so req.ip is the client's.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);

// The API only returns JSON and CSV, so the strictest CSP fits.
app.use(helmet({
  contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
  hsts: PROD && process.env.COOKIE_SECURE !== 'false'
}));

app.get('/healthz', async (req, res) => {
  try { await db.pool.query('SELECT 1'); res.json({ ok: true }); }
  catch (e) { res.status(503).json({ ok: false }); }
});

// Writes must come from our own pages: same-origin Origin header (when the
// browser sends one) and a JSON body. Together with SameSite=Strict cookies
// this blocks cross-site request forgery. The proxy must forward Host.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
function sameOrigin(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin) {
    let host;
    try { host = new URL(origin).host; } catch (e) { host = ''; }
    if (host !== req.get('host') && !ALLOWED_ORIGINS.includes(origin)) return res.status(403).json({ error: 'Cross-site request blocked.' });
  }
  const upload = req.method === 'POST' && req.path === '/media' && req.is('image/*');
  if (req.headers['content-length'] > 0 && !req.is('application/json') && !upload) return res.status(415).json({ error: 'Send JSON.' });
  next();
}

app.use('/api',
  limit(300, 60 * 1000),
  sameOrigin,
  express.json({ limit: '1mb' }),
  (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); },
  routes);

// Photos: file names are random and never reused, so they can be cached forever.
app.use('/media', express.static(media.UPLOAD_DIR, {
  index: false, redirect: false, dotfiles: 'deny', immutable: true, maxAge: '365d',
  setHeaders: (res) => res.set('Content-Type', 'image/webp')
}));

app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

// Errors: validation messages go back to the browser; anything else is logged.
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.expose === false ? 'Bad request.' : err.message });
  // Deliberate "busy" from a load gate: tell the client to retry, don't log it as a crash.
  if (err.status === 503) return res.status(503).set('Retry-After', '5').json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
});

(async () => {
  await media.ensureDir();
  await db.migrate();
  await db.seed();
  const server = app.listen(PORT, () => console.log('Ohh My Chicken! API on http://localhost:' + PORT));
  server.headersTimeout = 20000;  // drop clients that send headers very slowly (slowloris)
  server.requestTimeout = 120000; // whole request, including a 10 MB photo on a slow line
  const stop = () => server.close(() => db.pool.end().then(() => process.exit(0)));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
})().catch((e) => {
  // Connection failures to "localhost" arrive as an AggregateError with an empty message.
  const detail = e.message || (e.errors || []).map((err) => err.message).join('; ') || e.code || String(e);
  console.error('Failed to start:', detail);
  if (e.code === 'ECONNREFUSED') {
    console.error('Could not reach PostgreSQL at DATABASE_URL. Is the database running?');
  }
  process.exit(1);
});
