/* Smoke test of the production frontend server (built dist + live backend).
   Needs BACKEND_URL and `npm run build` first; skipped otherwise. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BACKEND = process.env.BACKEND_URL;
const ready = BACKEND && fs.existsSync(path.join(ROOT, 'dist', 'index.html'));
const skip = !ready && 'set BACKEND_URL and build first (npm run build)';
let B, server;

const freePort = () => new Promise((ok) => { const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => ok(p)); }); });
const get = (u) => fetch(B + u, { redirect: 'manual' });

test.before(async () => {
  if (!ready) return;
  const port = await freePort();
  B = 'http://127.0.0.1:' + port;
  server = spawn(process.execPath, [path.join(ROOT, 'server', 'index.js')], {
    env: { ...process.env, PORT: String(port), PUBLIC_URL: 'https://example.com', ADMIN_PATH: 'staff-ci' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let log = '';
  server.stdout.on('data', (d) => { log += d; });
  server.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(B + '/healthz')).ok) return; } catch (e) { /* starting */ }
    if (server.exitCode != null) throw new Error('frontend server exited:\n' + log);
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('frontend server did not start:\n' + log);
});
test.after(() => { if (server) server.kill(); });

test('home: server-rendered SEO head, inlined data, security headers', { skip }, async () => {
  const r = await get('/');
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /<title>[^<]*Pizza Restaurant[^<]*<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/example.com\/">/);
  assert.match(html, /"@type":"Restaurant"/);
  assert.match(html, /id="boot-data"/);
  assert.match(r.headers.get('content-security-policy'), /script-src 'self'/);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('x-powered-by'), null);
});

test('pages arrive with their real content, from the live data', { skip }, async () => {
  const home = await (await get('/')).text();
  assert.match(home, /The largest pizza in town/);
  assert.doesNotMatch(home, /aria-busy="true"/);
  assert.match(home, /<link rel="preload" href="\/static\/logo-192-[\w-]+\.webp" as="image"/);
  const menu = await (await get('/menu')).text();
  assert.match(menu, /Chicken BBQ Pizza/);
  assert.match(menu, /Rs\. 650/);
});

test('the built static files are real pages too', { skip: !fs.existsSync(path.join(ROOT, 'dist', 'index.html')) && 'build first' }, () => {
  const page = (f) => fs.readFileSync(path.join(ROOT, 'dist', f), 'utf8');
  assert.match(page('index.html'), /The largest pizza in town/);
  assert.match(page('menu/index.html'), /Chicken BBQ Pizza/);
  assert.match(page('menu/drinks/index.html'), /Cappuccino/);
  assert.doesNotMatch(page('index.html'), /aria-busy="true"/);
});

test('pages may be kept by a CDN for a minute; 404s, the dashboard and the API never', { skip }, async () => {
  assert.match((await get('/')).headers.get('cache-control'), /^public, max-age=0, s-maxage=60/);
  assert.equal((await get('/menu/does-not-exist')).headers.get('cache-control'), 'no-cache');
  assert.equal((await get('/staff-ci/')).headers.get('cache-control'), 'no-store');
  assert.equal((await get('/api/bootstrap')).headers.get('cache-control'), 'no-store');
});

test('category page 200, unknown page real 404 with noindex', { skip }, async () => {
  const cat = await get('/menu/chicken-pizza');
  assert.equal(cat.status, 200);
  assert.match(await cat.text(), /href="https:\/\/example.com\/menu\/chicken-pizza"/);
  const nf = await get('/menu/does-not-exist');
  assert.equal(nf.status, 404);
  assert.match(await nf.text(), /noindex/);
});

test('one URL per page: case and trailing slash redirect', { skip }, async () => {
  const r = await get('/Menu/');
  assert.equal(r.status, 301);
  assert.equal(r.headers.get('location'), '/menu');
});

test('dashboard only at ADMIN_PATH, never indexed', { skip }, async () => {
  const a = await get('/staff-ci/');
  assert.equal(a.status, 200);
  assert.match(a.headers.get('x-robots-tag'), /noindex/);
  assert.equal(a.headers.get('cache-control'), 'no-store');
  assert.equal((await get('/admin.html')).status, 404);
  assert.notEqual((await get('/admin/')).status, 200);
});

test('sitemap and robots point at the public URL', { skip }, async () => {
  const s = await (await get('/sitemap.xml')).text();
  assert.match(s, /<loc>https:\/\/example.com\/menu\/chicken-pizza<\/loc>/);
  const robots = await (await get('/robots.txt')).text();
  assert.match(robots, /Disallow: \/api\//);
  assert.match(robots, /Sitemap: https:\/\/example.com\/sitemap.xml/);
});

test('API is proxied to the backend', { skip }, async () => {
  const r = await get('/api/menu');
  assert.equal(r.status, 200);
  assert.ok((await r.json()).length > 0);
});

test('hashed bundles are cached for a year, no source maps shipped', { skip }, async () => {
  const js = fs.readdirSync(path.join(ROOT, 'dist', 'static')).find((f) => f.endsWith('.js'));
  const r = await get('/static/' + js);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('cache-control'), /max-age=31536000, immutable/);
  assert.equal(fs.readdirSync(path.join(ROOT, 'dist', 'static')).filter((f) => f.endsWith('.map')).length, 0);
});

test('no open redirect through the clean-URL redirect', { skip }, async () => {
  for (const u of ['//evil.example/', '/\\evil.example/', '//Evil.example/path/']) {
    const r = await get(u);
    const loc = r.headers.get('location') || '';
    assert.ok(!/^(\/\/|\/\\|https?:)/i.test(loc), u + ' redirected to ' + loc);
  }
});

test('HTTPS-only and permissions headers on pages', { skip }, async () => {
  const r = await get('/');
  assert.match(r.headers.get('strict-transport-security'), /max-age=31536000/);
  assert.match(r.headers.get('permissions-policy'), /camera=\(\)/);
});
