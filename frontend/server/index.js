/* ==========================================================================
   Frontend server — serves the React build, proxies /api to the backend
   and renders each page's <head> (title, description, canonical, social
   cards, schema.org data) from the live menu & settings, so search
   engines and link previews see the full page without running JS.
   Also: /sitemap.xml, /robots.txt, real 404s and the staff dashboard
   page at ADMIN_PATH.
   ========================================================================== */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import compression from 'compression';
import { resolveRoute, headHtml, safeJson, categoryPath } from '../src/shared/seo.js';

const PORT = Number(process.env.PORT) || 8080;
const BACKEND = new URL(process.env.BACKEND_URL || 'http://localhost:4000');
// The site's public address, e.g. https://ohhmychicken.com. Canonical URLs,
// the sitemap and social cards use it. Without it the request's host is used.
const PUBLIC_URL = String(process.env.PUBLIC_URL || '').replace(/\/+$/, '');
const ADMIN_PATH = '/' + String(process.env.ADMIN_PATH || 'admin').replace(/^\/+|\/+$/g, '');
const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const BOOT_TTL_MS = 5000;

const indexTpl = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
const adminPage = fs.readFileSync(path.join(DIST, 'admin.html'), 'utf8');
if (!indexTpl.includes('<!--seo:start-->') || !indexTpl.includes('<!--boot-->')) throw new Error('index.html is missing the <!--seo:start--> or <!--boot--> markers');

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);

/* ---------- Security headers ---------- */
// Scripts are all bundled, so the CSP allows only our origin plus Google Fonts.
// Inline style attributes are needed for CSS custom properties and GSAP.
// JSON data blocks (<script type="application/json">) are not executed, so no 'unsafe-inline'.
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-src 'self'; " +
  "frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'";
// HTTPS-only for a year once the site is served over https (PUBLIC_URL tells us).
const HSTS = PUBLIC_URL.startsWith('https://') ? 'max-age=31536000; includeSubDomains' : '';
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // The site never uses these; say so, so injected code couldn't either.
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
    // wa.me links open in a new tab; keep the opener isolated.
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups'
  });
  if (HSTS) res.set('Strict-Transport-Security', HSTS);
  if (!req.path.startsWith('/api/') && !req.path.startsWith('/media/')) res.set('Content-Security-Policy', CSP);
  next();
});

/* ---------- API proxy (streams both ways; keeps Host for the backend's Origin check) ---------- */
// /api (JSON) and /media (photo files) both live on the backend.
// Hop-by-hop headers describe one connection; forwarding them invites request smuggling.
const HOP = ['connection', 'keep-alive', 'proxy-connection', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade'];
const proxy = (req, res) => {
  const headers = { ...req.headers };
  HOP.forEach((h) => delete headers[h]);
  const fwd = headers['x-forwarded-for'];
  headers['x-forwarded-for'] = (fwd ? fwd + ', ' : '') + req.socket.remoteAddress;
  headers['x-forwarded-proto'] = req.protocol;
  const up = http.request({
    hostname: BACKEND.hostname, port: BACKEND.port || 80, method: req.method,
    path: req.originalUrl, headers,
    timeout: req.method === 'POST' && req.originalUrl.startsWith('/api/media') ? 120000 : 30000
  }, (r) => {
    const out = { ...r.headers };
    HOP.forEach((h) => delete out[h]);
    res.writeHead(r.statusCode, out);
    r.pipe(res);
  });
  up.on('timeout', () => up.destroy(new Error('upstream timeout')));
  up.on('error', () => { if (!res.headersSent) res.status(502).json({ error: 'The kitchen server is not answering. Please try again.' }); else res.end(); });
  req.on('aborted', () => up.destroy());
  req.pipe(up);
};
app.use('/api', proxy);
app.use('/media', proxy);

app.use(compression());

/* ---------- Live data for the pages (short cache) ---------- */
let boot = null, bootAt = 0, pending = null;
function getBoot() {
  if (boot && Date.now() - bootAt < BOOT_TTL_MS) return Promise.resolve(boot);
  if (!pending) {
    pending = fetch(new URL('/api/bootstrap', BACKEND), { signal: AbortSignal.timeout(3000) })
      .then((r) => { if (!r.ok) throw new Error('bootstrap ' + r.status); return r.json(); })
      .then((b) => { boot = b; bootAt = Date.now(); return b; })
      .catch((e) => { console.warn('Could not load menu for SEO:', e.message); return boot; }) // keep serving the last good copy
      .finally(() => { pending = null; });
  }
  return pending;
}

const originOf = (req) => PUBLIC_URL || req.protocol + '://' + req.get('host');

app.get('/healthz', (req, res) => res.type('text/plain').send('ok\n'));

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').set('Cache-Control', 'public, max-age=3600').send(
    'User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ' + originOf(req) + '/sitemap.xml\n'
  );
});

app.get('/sitemap.xml', async (req, res) => {
  const b = await getBoot();
  const origin = originOf(req);
  const lastmod = b && b.updatedAt ? '<lastmod>' + b.updatedAt.slice(0, 10) + '</lastmod>' : '';
  const cats = b ? b.defaults.CATEGORIES.filter((c) => b.menu.some((m) => m.category === c.id)) : [];
  const urls = [['/', '1.0'], ['/menu', '0.9']].concat(cats.map((c) => [categoryPath(c), '0.8']));
  res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(([u, p]) => '  <url><loc>' + origin + u + '</loc>' + lastmod + '<priority>' + p + '</priority></url>').join('\n') +
    '\n</urlset>\n'
  );
});

/* ---------- Staff dashboard: only at ADMIN_PATH ---------- */
const sendAdmin = (req, res) => res.set({ 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' }).type('html').send(adminPage);
// Express matches "/admin" and "/admin/" alike; the page needs the trailing slash.
app.get(ADMIN_PATH, (req, res) => (req.path.endsWith('/') ? sendAdmin(req, res)
  : res.redirect(301, ADMIN_PATH + '/' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''))));

/* ---------- Static files ---------- */
app.get('/index.html', (req, res) => res.redirect(301, '/'));
const assets = express.static(DIST, {
  index: false,
  redirect: false,
  setHeaders: (res, file) => {
    res.set('Cache-Control', file.includes(path.sep + 'static' + path.sep) ? 'public, max-age=31536000, immutable' : 'public, max-age=86400');
  }
});
// HTML files are only served through the page routes below (so /admin.html is a 404).
app.use((req, res, next) => (/\.html$/i.test(req.path) ? next() : assets(req, res, next)));

/* ---------- Pages ---------- */
app.get(/.*/, async (req, res) => {
  // One URL per page: lowercase, no trailing slash.
  // (File paths like /static/X.js keep their case: a missing one is just a 404.)
  const clean = req.path.length > 1 && !/\.[a-z0-9]+$/i.test(req.path) ? req.path.replace(/\/+$/, '').toLowerCase() : req.path;
  // Never redirect to "//host" or "/\host": browsers treat both as another site (open redirect).
  const offSite = /^\/[\/\\]/.test(clean) || /^\/[\/\\]/.test(req.path);
  if (clean !== req.path && !offSite) return res.redirect(301, clean + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''));

  const b = await getBoot();
  const route = resolveRoute(req.path, b ? b.defaults.CATEGORIES : []);
  let html = indexTpl;
  if (b) {
    html = html.replace(/<!--seo:start-->[\s\S]*?<!--seo:end-->/, headHtml(route, b, originOf(req)))
      .replace('<!--boot-->', '<script type="application/json" id="boot-data">' + safeJson(b) + '</script>');
  }
  // Without menu data we can't tell a category from a typo: serve the app, don't index.
  const status = b && route.view === 'notfound' ? 404 : 200;
  if (!b) html = html.replace('<!--seo:start-->', '<meta name="robots" content="noindex"><!--seo:start-->');
  res.status(status).set('Cache-Control', 'no-cache').type('html').send(html);
});

if (process.env.NODE_ENV === 'production' && !PUBLIC_URL) {
  console.warn('PUBLIC_URL is not set: canonical links and the sitemap will use whatever Host header visitors send. Set PUBLIC_URL=https://your-domain.');
}
const server = app.listen(PORT, () => console.log('Ohh My Chicken! frontend on http://localhost:' + PORT + ' (API: ' + BACKEND.origin + ')'));
// Drop clients that send their request very slowly (slowloris).
server.headersTimeout = 20000;
server.requestTimeout = 130000; // a large photo upload on a slow phone connection still fits
