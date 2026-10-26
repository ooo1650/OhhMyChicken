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
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // wa.me links open in a new tab; keep the opener isolated.
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups'
  });
  if (!req.path.startsWith('/api/')) res.set('Content-Security-Policy', CSP);
  next();
});

/* ---------- API proxy (streams both ways; keeps Host for the backend's Origin check) ---------- */
app.use('/api', (req, res) => {
  const headers = { ...req.headers };
  const fwd = headers['x-forwarded-for'];
  headers['x-forwarded-for'] = (fwd ? fwd + ', ' : '') + req.socket.remoteAddress;
  headers['x-forwarded-proto'] = req.protocol;
  const up = http.request({
    hostname: BACKEND.hostname, port: BACKEND.port || 80, method: req.method,
    path: req.originalUrl, headers
  }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  up.on('error', () => { if (!res.headersSent) res.status(502).json({ error: 'The kitchen server is not answering. Please try again.' }); else res.end(); });
  req.pipe(up);
});

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
  const clean = req.path.length > 1 ? req.path.replace(/\/+$/, '').toLowerCase() : req.path;
  if (clean !== req.path) return res.redirect(301, clean + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''));

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

app.listen(PORT, () => console.log('Ohh My Chicken! frontend on http://localhost:' + PORT + ' (API: ' + BACKEND.origin + ')'));
