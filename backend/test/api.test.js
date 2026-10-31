/* API tests: start the real server against a real (empty, throwaway)
   PostgreSQL database and talk to it over HTTP.
   Needs DATABASE_URL; skipped without it. CI provides a postgres service. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const net = require('node:net');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DB = process.env.DATABASE_URL;
const PASS = 'ci-test-passcode-1';
let B, server, uploads, cookie = '';

function freePort() {
  return new Promise((ok) => { const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => ok(p)); }); });
}

async function req(method, url, { body, headers = {}, raw } = {}) {
  const h = { ...headers };
  if (cookie) h.Cookie = cookie;
  let payload = raw;
  if (body !== undefined) { h['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const r = await fetch(B + url, { method, headers: h, body: payload, redirect: 'manual' });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { /* not JSON */ }
  return { status: r.status, json, text, headers: r.headers };
}

test.before(async () => {
  if (!DB) return;
  const port = await freePort();
  B = 'http://127.0.0.1:' + port;
  uploads = fs.mkdtempSync(path.join(os.tmpdir(), 'omc-uploads-'));
  server = spawn(process.execPath, [path.join(__dirname, '..', 'src', 'index.js')], {
    env: { ...process.env, PORT: String(port), ADMIN_PASSCODE: PASS, UPLOAD_DIR: uploads, NODE_ENV: 'test', ORDER_LIMIT: '200', INSIGHTS_ENABLED: 'true' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let log = '';
  server.stdout.on('data', (d) => { log += d; });
  server.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(B + '/healthz')).ok) return; } catch (e) { /* not up yet */ }
    if (server.exitCode != null) throw new Error('server exited:\n' + log);
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('server did not start:\n' + log);
});

test.after(() => {
  if (server) server.kill();
  if (uploads) fs.rmSync(uploads, { recursive: true, force: true });
});

const it = (name, fn) => test(name, { skip: !DB && 'set DATABASE_URL to run API tests' }, fn);

it('health check and public bootstrap', async () => {
  assert.equal((await req('GET', '/healthz')).status, 200);
  const b = await req('GET', '/api/bootstrap');
  assert.equal(b.status, 200);
  assert.ok(b.json.menu.length > 10);
  assert.ok(b.json.defaults.CATEGORIES.every((c) => c.slug));
  assert.ok(Array.isArray(b.json.gallery));
  assert.equal(b.headers.get('cache-control'), 'no-store');
  assert.equal(b.headers.get('x-powered-by'), null);
});

it('admin endpoints refuse anonymous requests', async () => {
  for (const [m, u] of [['GET', '/api/orders'], ['GET', '/api/orders.csv'], ['GET', '/api/media'], ['PUT', '/api/menu/m1'], ['DELETE', '/api/orders'], ['PUT', '/api/settings']]) {
    const r = await req(m, u, m === 'GET' ? {} : { body: {} });
    assert.equal(r.status, 401, m + ' ' + u);
  }
});

it('anonymous session does not reveal whether the default passcode is in use', async () => {
  const s = await req('GET', '/api/admin/session');
  assert.deepEqual(s.json, { authed: false });
});

it('cross-site and non-JSON writes are blocked', async () => {
  const cross = await req('POST', '/api/orders', { body: {}, headers: { Origin: 'https://evil.example' } });
  assert.equal(cross.status, 403);
  const form = await req('POST', '/api/admin/login', { raw: 'passcode=x', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  assert.equal(form.status, 415);
});

it('login: wrong passcode fails, right one sets an httpOnly cookie', async () => {
  const bad = await req('POST', '/api/admin/login', { body: { passcode: 'wrong-guess-123' } });
  assert.equal(bad.status, 401);
  const ok = await req('POST', '/api/admin/login', { body: { passcode: PASS } });
  assert.equal(ok.status, 200);
  const set = ok.headers.get('set-cookie');
  assert.match(set, /HttpOnly/);
  assert.match(set, /SameSite=Strict/);
  cookie = set.split(';')[0];
  const s = await req('GET', '/api/admin/session');
  assert.equal(s.json.authed, true);
  assert.equal(s.json.defaultPass, false);
  assert.ok(s.json.expiresInMs > 3590000 && s.json.expiresInMs <= 3600000, 'one hour: ' + s.json.expiresInMs);
});

it('orders: totals are recalculated on the server', async () => {
  const menu = (await req('GET', '/api/menu')).json;
  const item = menu.find((m) => m.isPizza);
  const xl = item.prices.find((p) => /22/.test(p.label));
  const r = await req('POST', '/api/orders', {
    body: { name: 'CI Test', phone: '+977 9800000001', address: 'Table 4', code: 'OHH22', outlet: 'maharajgunj',
      items: [{ id: item.id, label: xl.label, qty: 1, price: 1 /* ignored */ }], total: 1 }
  });
  assert.equal(r.status, 201);
  const settings = (await req('GET', '/api/settings')).json;
  const discount = Math.round(xl.price * settings.promo.percent / 100);
  assert.equal(r.json.subtotal, xl.price);
  assert.equal(r.json.discount, discount);
  assert.equal(r.json.total, xl.price - discount + r.json.delivery);
  assert.equal(r.json.status, 'new');
  assert.equal(r.json.outlet, 'Maharajgunj');
});

it('orders: names and addresses are stored without hidden characters', async () => {
  const menu = (await req('GET', '/api/menu')).json;
  const o = await req('POST', '/api/orders', { body: { name: 'Ram\u202E lahaB\u0007', phone: '+977 9800000004', address: 'Sanepa\r\n<script>x</script>', outlet: 'jhamsikhel',
    items: [{ id: menu[0].id, label: menu[0].prices[0].label, qty: 1 }] } });
  assert.equal(o.status, 201);
  assert.equal(o.json.name, 'Ram lahaB');
  assert.equal(o.json.address, 'Sanepa <script>x</script>'); // stored as text; React escapes it when shown
});

it('orders: only what the order needs; promo needs name and phone; table orders pay no delivery', async () => {
  const menu = (await req('GET', '/api/menu')).json;
  const items = [{ id: menu[0].id, label: menu[0].prices[0].label, qty: 1 }];
  const plain = await req('POST', '/api/orders', { body: { address: 'Sanepa, near the temple', outlet: 'jhamsikhel', items } });
  assert.equal(plain.status, 201);
  assert.equal(plain.json.name, '');
  assert.equal(plain.json.mode, 'delivery');
  assert.equal((await req('POST', '/api/orders', { body: { outlet: 'jhamsikhel', items } })).status, 400); // delivery needs an address
  const table = await req('POST', '/api/orders', { body: { mode: 'table', table: '7', outlet: 'jhamsikhel', items } });
  assert.equal(table.json.address, 'Table 7');
  assert.equal(table.json.delivery, 0);
  assert.equal((await req('POST', '/api/orders', { body: { mode: 'pickup', outlet: 'jhamsikhel', items } })).status, 400); // takeaway is off
  const pz = menu.find((m) => m.isPizza), xl = pz.prices.find((p) => /22/.test(p.label));
  const promo = { address: 'Home', outlet: 'jhamsikhel', code: 'OHH22', items: [{ id: pz.id, label: xl.label, qty: 1 }] };
  assert.match((await req('POST', '/api/orders', { body: { ...promo, phone: '+977 9811111111' } })).json.error, /name and phone/);
  assert.match((await req('POST', '/api/orders', { body: { ...promo, name: 'Sita' } })).json.error, /name and phone/);
});

it('customers: kept only with consent, exported and removed from the server', async () => {
  const { spawnSync } = require('node:child_process');
  const cli = (...args) => spawnSync(process.execPath, [path.join(__dirname, '..', 'src', 'db.js'), ...args], { env: process.env, encoding: 'utf8' });
  const menu = (await req('GET', '/api/menu')).json;
  const items = [{ id: menu[0].id, label: menu[0].prices[0].label, qty: 1 }];
  await req('POST', '/api/orders', { body: { name: 'No Consent', phone: '+977 9822222222', address: 'x', outlet: 'jhamsikhel', items } });
  await req('POST', '/api/orders', { body: { name: 'Hari', phone: '+977 9833333333', address: 'x', outlet: 'jhamsikhel', saveDetails: true, items } });
  await req('POST', '/api/orders', { body: { name: '', phone: '9833333333', address: 'x', outlet: 'maharajgunj', saveDetails: true, items } });
  const csv = cli('customers').stdout;
  assert.match(csv, /"Hari","9833333333","2","Maharajgunj"/);
  assert.doesNotMatch(csv, /No Consent|9822222222/);
  assert.match(cli('forget-customer', '+977 983-3333333').stdout, /Removed from the customer list/);
  assert.doesNotMatch(cli('customers').stdout, /Hari/);
});

it('orders: customer details are blanked after ORDER_DETAILS_DAYS, totals kept', async () => {
  const { pool } = require('../src/db');
  const models = require('../src/models');
  const menu = (await req('GET', '/api/menu')).json;
  const o = await req('POST', '/api/orders', { body: { name: 'Old', phone: '+977 9844444444', address: 'Old street', outlet: 'jhamsikhel', items: [{ id: menu[0].id, label: menu[0].prices[0].label, qty: 1 }] } });
  await pool.query("UPDATE orders SET created_at = now() - interval '400 days' WHERE id = $1", [o.json.id]);
  assert.ok(await models.forgetOldCustomerDetails() >= 1);
  const after = (await req('GET', '/api/orders')).json.find((x) => x.id === o.json.id);
  assert.deepEqual([after.name, after.phone, after.address], ['', '', '']);
  assert.equal(after.total, o.json.total);
  await pool.end();
});

it('orders: invalid input is rejected', async () => {
  assert.equal((await req('POST', '/api/orders', { body: { name: 'A', phone: 'call me', address: 'x', items: [{ id: 'm1', label: '12" S', qty: 1 }] } })).status, 400);
  assert.equal((await req('POST', '/api/orders', { body: { name: 'A', phone: '+9779800000000', address: 'x', items: [] } })).status, 400);
});

it('orders: with several outlets the customer must pick an open one', async () => {
  const menu = (await req('GET', '/api/menu')).json;
  const body = { name: 'B', phone: '+977 9800000003', address: 'Home', items: [{ id: menu[0].id, label: menu[0].prices[0].label, qty: 1 }] };
  const none = await req('POST', '/api/orders', { body });
  assert.equal(none.status, 400);
  assert.match(none.json.error, /choose an outlet/);
  assert.equal((await req('POST', '/api/orders', { body: { ...body, outlet: 'nowhere' } })).status, 400);
  const s = (await req('GET', '/api/settings')).json;
  const hidden = s.outlets.map((o) => (o.id === 'bhaktapur' ? { ...o, active: false } : o));
  assert.equal((await req('PUT', '/api/settings', { body: { outlets: hidden } })).status, 200);
  assert.equal((await req('POST', '/api/orders', { body: { ...body, outlet: 'bhaktapur' } })).status, 400);
  assert.equal((await req('PUT', '/api/settings', { body: { outlets: s.outlets } })).status, 200);
});

it('settings: outlets are validated', async () => {
  const s = (await req('GET', '/api/settings')).json;
  const bad = (o) => req('PUT', '/api/settings', { body: { outlets: [{ ...s.outlets[0], ...o }] } });
  assert.equal((await bad({ whatsapp: '12' })).status, 400);
  assert.equal((await bad({ phones: ['call me'] })).status, 400);
  assert.equal((await bad({ mapsUrl: 'javascript:alert(1)' })).status, 400);
  assert.equal((await bad({ hoursOpen: '10:00', hoursClose: '' })).status, 400);
  assert.equal((await req('PUT', '/api/settings', { body: { outlets: [s.outlets[0], s.outlets[0]] } })).status, 400);
});

it('orders: status workflow and CSV export escapes formulas', async () => {
  const menu = (await req('GET', '/api/menu')).json;
  const o = await req('POST', '/api/orders', { body: { name: '=HYPERLINK("http://x")', phone: '+977 9800000002', address: '@home', outlet: 'jhamsikhel', items: [{ id: menu[0].id, label: menu[0].prices[0].label, qty: 1 }] } });
  assert.equal(o.status, 201);
  const p = await req('PATCH', '/api/orders/' + o.json.id, { body: { status: 'preparing' } });
  assert.equal(p.json.status, 'preparing');
  assert.equal((await req('PATCH', '/api/orders/' + o.json.id, { body: { status: 'eaten' } })).status, 400);
  const csv = await req('GET', '/api/orders.csv');
  assert.equal(csv.status, 200);
  assert.match(csv.text, /"'=HYPERLINK/);
  assert.match(csv.text, /"'@home"/);
  assert.match(csv.text, /"Outlet"/);
  assert.match(csv.text, /"Jhamsikhel"/);
});

it('settings: invalid values are rejected, valid ones saved', async () => {
  assert.equal((await req('PUT', '/api/settings', { body: { lat: 999 } })).status, 400);
  const ok = await req('PUT', '/api/settings', { body: { city: 'Lalitpur', lat: '27.67', lng: '85.32' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.city, 'Lalitpur');
  assert.equal((await req('GET', '/api/bootstrap')).json.settings.lat, 27.67);
});

it('photos: upload, link to a dish, serve, delete', async () => {
  // A real 800x600 PNG made in memory.
  const sharp = require('sharp');
  const png = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#d9822b' } }).png().toBuffer();
  const fake = await req('POST', '/api/media', { raw: Buffer.from('not an image'), headers: { 'Content-Type': 'image/png' } });
  assert.equal(fake.status, 400);

  const up = await req('POST', '/api/media', { raw: png, headers: { 'Content-Type': 'image/png', 'X-File-Name': encodeURIComponent('Chicken BBQ.png') } });
  assert.equal(up.status, 201);
  assert.equal(up.json.alt, 'Chicken BBQ');
  assert.deepEqual(up.json.sizes.map((s) => s.w), [320, 480, 640, 800]);

  const file = await fetch(B + up.json.sizes[0].url);
  assert.equal(file.status, 200);
  assert.equal(file.headers.get('content-type'), 'image/webp');
  assert.match(file.headers.get('cache-control'), /s-maxage=31536000, immutable/);

  // A wiped disk loses nothing: the file comes back from the database, and is put back on disk.
  const name = up.json.sizes[0].url.split('/').pop();
  const original = Buffer.from(await file.arrayBuffer());
  fs.rmSync(path.join(uploads, name));
  const restored = await fetch(B + up.json.sizes[0].url);
  assert.equal(restored.status, 200);
  assert.equal(restored.headers.get('content-type'), 'image/webp');
  assert.ok(original.equals(Buffer.from(await restored.arrayBuffer())));
  assert.ok(fs.existsSync(path.join(uploads, name)));
  assert.equal((await fetch(B + '/media/' + 'a'.repeat(24) + '-320.webp')).status, 404);
  assert.equal((await fetch(B + '/media/..%2Fpackage.json')).status, 404);

  const menu = (await req('GET', '/api/menu')).json;
  const linked = await req('PUT', '/api/menu/' + menu[0].id, { body: { ...menu[0], imageId: up.json.id, art: 'pizza-smoky' } });
  assert.equal(linked.json.image.id, up.json.id);
  assert.equal(linked.json.art, 'pizza-smoky');

  assert.equal((await req('DELETE', '/api/media/' + up.json.id)).status, 200);
  assert.equal((await fetch(B + up.json.sizes[0].url)).status, 404);
  const after = (await req('GET', '/api/menu')).json.find((m) => m.id === menu[0].id);
  assert.equal(after.image, null);
});

it('oversized bodies and image bombs are refused', async () => {
  assert.equal((await req('POST', '/api/orders', { body: { name: 'x'.repeat(2 * 1024 * 1024) } })).status, 413);
  assert.equal((await req('POST', '/api/media', { raw: Buffer.alloc(11 * 1024 * 1024, 1), headers: { 'Content-Type': 'image/png' } })).status, 413);
  // A real 9000x9000 PNG (81 MP): tiny on disk, huge in memory.
  const sharp = require('sharp');
  const bomb = await sharp({ create: { width: 9000, height: 9000, channels: 3, background: '#000' }, limitInputPixels: false }).png({ compressionLevel: 9 }).toBuffer();
  const r = await req('POST', '/api/media', { raw: bomb, headers: { 'Content-Type': 'image/png' } });
  assert.equal(r.status, 400);
  assert.match(r.json.error, /megapixels/);
  const svg = await req('POST', '/api/media', { raw: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900"/>'), headers: { 'Content-Type': 'image/svg+xml' } });
  assert.equal(svg.status, 400);
});

it('photo files cannot be used to read other files', async () => {
  for (const u of ['/media/../package.json', '/media/%2e%2e/package.json', '/media/.env']) {
    assert.notEqual((await fetch(B + u)).status, 200, u);
  }
});

it('analytics: anonymous events in, insights out (admin only)', async () => {
  const UA = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148' };
  const send = (events, headers = {}) => req('POST', '/api/t', { body: { events }, headers: { ...UA, ...headers } });
  const before = (await req('GET', '/api/insights?days=7')).json;

  assert.equal((await send([
    { name: 'page_view', path: '/menu?table=4', referrer: 'www.Google.com', table_no: '4' },
    { name: 'search', value: 'Burger', num: 0 },
    { name: 'add_to_cart', item_id: 'm1', value: '22" XL', num: 1 },
    { name: 'search', value: 'call me on 9800012345', num: 0 },
    { name: 'chat_question', value: 'no longer collected' },
    { name: 'not_an_event', value: 'dropped' }
  ])).status, 204);
  // Opt-outs and bots: accepted (204) but nothing stored.
  assert.equal((await send([{ name: 'search', value: 'dnt-search', num: 0 }], { DNT: '1' })).status, 204);
  assert.equal((await send([{ name: 'search', value: 'gpc-search', num: 0 }], { 'Sec-GPC': '1' })).status, 204);
  assert.equal((await send([{ name: 'search', value: 'bot-search', num: 0 }], { 'User-Agent': 'Googlebot/2.1' })).status, 204);
  // Bad input
  assert.equal((await send(Array.from({ length: 21 }, () => ({ name: 'cart_open' })))).status, 400);
  assert.equal((await req('POST', '/api/t', { body: { events: 'x' } })).status, 400);

  // Insights are for staff only.
  const anon = cookie; cookie = '';
  assert.equal((await req('GET', '/api/insights')).status, 401);
  cookie = anon;

  const after = (await req('GET', '/api/insights?days=7')).json;
  assert.equal(after.funnel.added, before.funnel.added + 1);
  assert.ok(after.emptySearches.some((s) => s.query === 'burger'));
  const searched = after.searches.map((s) => s.query);
  for (const hidden of ['dnt-search', 'gpc-search', 'bot-search']) assert.ok(!searched.includes(hidden), hidden + ' must not be stored');
  assert.ok(after.referrers.some((r) => r.referrer === 'google.com'));
  assert.ok(after.tables.some((t) => t.table_no === '4'));
  assert.ok(after.devices.some((d) => d.device === 'mobile'));
  assert.ok(searched.some((v) => /###/.test(v)) && !searched.some((v) => /9800012345/.test(v)), 'phone numbers are masked');
  assert.ok(!('chat' in after), 'chat questions are not collected');
  assert.equal(after.hours.length, 24);
  assert.equal(after.daily.length, 7);

  // Placing an order is recorded server-side for the funnel.
  const menu = (await req('GET', '/api/menu')).json;
  await req('POST', '/api/orders', { body: { name: 'Funnel', phone: '+977 9800000009', address: 'Table 4', outlet: 'jhamsikhel', items: [{ id: menu[0].id, label: menu[0].prices[0].label, qty: 1 }] }, headers: UA });
  const last = (await req('GET', '/api/insights?days=7')).json;
  assert.equal(last.funnel.ordered, after.funnel.ordered + 1);
  assert.ok(last.tables.find((t) => t.table_no === '4').orders >= 1);
});

it('promo: once per phone number, checked before ordering and enforced by the server', async () => {
  const menu = (await req('GET', '/api/menu')).json;
  const item = menu.find((m) => m.isPizza), xl = item.prices.find((p) => /22/.test(p.label));
  const body = { name: 'Promo', phone: '+977 981-2345678', address: 'Home', outlet: 'jhamsikhel', code: 'OHH22', items: [{ id: item.id, label: xl.label, qty: 1 }] };
  assert.equal((await req('POST', '/api/promo/check', { body: { code: 'OHH22', phone: '9812345678' } })).json.used, false);
  const first = await req('POST', '/api/orders', { body });
  assert.ok(first.json.discount > 0);
  assert.equal((await req('POST', '/api/promo/check', { body: { code: 'ohh22', phone: '+9779812345678' } })).json.used, true);
  const second = await req('POST', '/api/orders', { body });
  assert.equal(second.status, 201);
  assert.equal(second.json.discount, 0);
  assert.equal(second.json.promoRejected, true);
  // Cancelling the order frees the code again.
  await req('PATCH', '/api/orders/' + first.json.id, { body: { status: 'cancelled' } });
  assert.equal((await req('POST', '/api/promo/check', { body: { code: 'OHH22', phone: '9812345678' } })).json.used, false);
});

it('security: weak passcodes refused, sign-ins logged, other devices can be signed out', async () => {
  const weak = await req('PUT', '/api/admin/passcode', { body: { current: PASS, passcode: 'pizza12345' } });
  assert.equal(weak.status, 400);
  assert.match(weak.json.error, /Too easy to guess/);
  const sec = (await req('GET', '/api/admin/security')).json;
  assert.ok(sec.recent.some((r) => r.ok) && sec.recent.some((r) => !r.ok));
  assert.ok(sec.failed24h >= 1);
  assert.ok(!('lastBackup' in sec)); // no BACKUP_DIR here
  const other = await fetch(B + '/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passcode: PASS }) });
  const otherCookie = other.headers.get('set-cookie').split(';')[0];
  assert.ok((await req('POST', '/api/admin/sign-out-others', { body: {} })).json.signedOut >= 1);
  assert.equal((await fetch(B + '/api/orders', { headers: { Cookie: otherCookie } })).status, 401);
  assert.equal((await req('GET', '/api/orders')).status, 200);
});

it('forgotten passcode: set-passcode on the server replaces it and signs everyone out', async () => {
  const { spawnSync } = require('node:child_process');
  const run = (pass) => spawnSync(process.execPath, [path.join(__dirname, '..', 'src', 'db.js'), 'set-passcode'],
    { env: { ...process.env, NEW_PASSCODE: pass }, encoding: 'utf8' });
  assert.notEqual(run('short1').status, 0);
  const ok = run('kitchen-door-blue-77');
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal((await req('GET', '/api/orders')).status, 401);
  assert.equal((await req('POST', '/api/admin/login', { body: { passcode: PASS } })).status, 401);
  assert.equal((await req('POST', '/api/admin/login', { body: { passcode: 'kitchen-door-blue-77' } })).status, 200);
  // Put the test passcode back and sign in again for the remaining tests.
  assert.equal(run(PASS).status, 0);
  const again = await req('POST', '/api/admin/login', { body: { passcode: PASS } });
  cookie = again.headers.get('set-cookie').split(';')[0];
  assert.equal((await req('GET', '/api/orders')).status, 200);
});

it('insights: locked unless the server switches it on, even for a signed-in admin', async () => {
  const port = await freePort(), base = 'http://127.0.0.1:' + port;
  const { INSIGHTS_ENABLED, ...env } = process.env; // eslint-disable-line no-unused-vars
  const locked = spawn(process.execPath, [path.join(__dirname, '..', 'src', 'index.js')],
    { env: { ...env, PORT: String(port), ADMIN_PASSCODE: PASS, UPLOAD_DIR: uploads, NODE_ENV: 'test' }, stdio: 'ignore' });
  try {
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(base + '/healthz')).ok) break; } catch (e) { /* not up yet */ }
      await new Promise((r) => setTimeout(r, 200));
    }
    assert.equal((await fetch(base + '/api/insights')).status, 401);
    const login = await fetch(base + '/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passcode: PASS }) });
    const Cookie = login.headers.get('set-cookie').split(';')[0];
    const r = await fetch(base + '/api/insights', { headers: { Cookie } });
    assert.equal(r.status, 402);
    assert.ok(!('totals' in await r.json()));
  } finally { locked.kill(); }
});

it('sessions: one hour from login, not extended by use, refused once over', async () => {
  const { Client } = require('pg');
  const login = await fetch(B + '/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passcode: PASS }) });
  const header = login.headers.get('set-cookie');
  assert.match(header, /Max-Age=3600\b/);
  assert.match(header, /HttpOnly/);
  const mine = header.split(';')[0], get = (u) => fetch(B + u, { headers: { Cookie: mine } });
  const left = async () => (await (await get('/api/admin/session')).json()).expiresInMs;
  const first = await left();
  await get('/api/orders');
  await new Promise((r) => setTimeout(r, 1100));
  assert.ok(await left() < first, 'using the dashboard does not extend it');
  const db = new Client({ connectionString: DB });
  await db.connect();
  const crypto = require('node:crypto');
  const hash = crypto.createHash('sha256').update(decodeURIComponent(mine.split('=')[1])).digest('hex');
  await db.query("UPDATE admin_sessions SET expires_at = now() - interval '1 second' WHERE token_hash = $1", [hash]);
  await db.end();
  assert.equal((await get('/api/orders')).status, 401);
  assert.deepEqual(await (await get('/api/admin/session')).json(), { authed: false });
});

it('outlets: old default WhatsApp numbers move to the new ones, numbers set by hand stay', async () => {
  const { Client } = require('pg');
  const db = new Client({ connectionString: DB });
  await db.connect();
  const read = async () => (await db.query('SELECT data FROM settings WHERE id = 1')).rows[0].data;
  const saved = await read();
  const edited = JSON.parse(JSON.stringify(saved));
  edited.whatsapp = '9779841336695';
  edited.outlets.find((o) => o.id === 'jhamsikhel').whatsapp = '9779841336695';
  edited.outlets.find((o) => o.id === 'maharajgunj').whatsapp = '9779860060005';
  edited.outlets.find((o) => o.id === 'bhaktapur').whatsapp = '9779812345678';
  await db.query('UPDATE settings SET data = $1 WHERE id = 1', [JSON.stringify(edited)]);
  await db.query("DELETE FROM data_changes WHERE id = 'outlet-whatsapp-numbers'");
  const init = spawnSync(process.execPath, [path.join(__dirname, '..', 'src', 'db.js'), 'init'], { env: { ...process.env, ADMIN_PASSCODE: PASS } });
  assert.equal(init.status, 0, String(init.stderr));
  const after = await read(), num = (id) => after.outlets.find((o) => o.id === id).whatsapp;
  assert.equal(after.whatsapp, '9779841103351');
  assert.equal(num('jhamsikhel'), '9779841103351');
  assert.equal(num('maharajgunj'), '9779709174249');
  assert.equal(num('bhaktapur'), '9779812345678');
  // It only happens once: going back to an old number in the dashboard sticks.
  after.outlets.find((o) => o.id === 'maharajgunj').whatsapp = '9779860060005';
  await db.query('UPDATE settings SET data = $1 WHERE id = 1', [JSON.stringify(after)]);
  spawnSync(process.execPath, [path.join(__dirname, '..', 'src', 'db.js'), 'init'], { env: { ...process.env, ADMIN_PASSCODE: PASS } });
  assert.equal((await read()).outlets.find((o) => o.id === 'maharajgunj').whatsapp, '9779860060005');
  await db.query('UPDATE settings SET data = $1 WHERE id = 1', [JSON.stringify(saved)]);
  await db.end();
});

it('outlets: Pokhara joins saved branch lists once, and stays gone if staff remove it', async () => {
  const { Client } = require('pg');
  const db = new Client({ connectionString: DB });
  await db.connect();
  const init = () => spawnSync(process.execPath, [path.join(__dirname, '..', 'src', 'db.js'), 'init'], { env: { ...process.env, ADMIN_PASSCODE: PASS } });
  const read = async () => (await db.query('SELECT data FROM settings WHERE id = 1')).rows[0].data;
  const saved = await read();
  const without = { ...saved, outlets: saved.outlets.filter((o) => o.id !== 'pokhara') };
  await db.query('UPDATE settings SET data = $1 WHERE id = 1', [JSON.stringify(without)]);
  await db.query("DELETE FROM data_changes WHERE id = 'pokhara-outlet'");
  init();
  const pokhara = (await read()).outlets.find((o) => o.id === 'pokhara');
  assert.equal(pokhara.whatsapp, '9779841103351');
  assert.equal(pokhara.lat, null);
  await db.query('UPDATE settings SET data = $1 WHERE id = 1', [JSON.stringify(without)]);
  init();
  assert.ok(!(await read()).outlets.some((o) => o.id === 'pokhara'));
  await db.query('UPDATE settings SET data = $1 WHERE id = 1', [JSON.stringify(saved)]);
  await db.end();
});

it('menu: counter-made drinks stay on the menu but can only be ordered at a table', async () => {
  const menu = (await req('GET', '/api/menu')).json;
  const coffee = menu.find((m) => m.id === 'cappuccino'), coke = menu.find((m) => m.id === 'coke-fanta-sprite');
  assert.ok(coffee && coffee.available && coffee.noDelivery);
  assert.equal(coke.noDelivery, false);
  assert.equal(menu.filter((m) => m.category !== 'drinks' && m.noDelivery).length, 0);
  const line = (m) => ({ id: m.id, label: m.prices[0].label, qty: 1 });
  const order = { outlet: 'jhamsikhel', items: [line(coffee), line(coke)] };
  const no = await req('POST', '/api/orders', { body: { ...order, mode: 'delivery', address: 'Home' } });
  assert.equal(no.status, 400);
  assert.match(no.json.error, /Cappuccino can't be delivered/);
  assert.equal((await req('POST', '/api/orders', { body: { ...order, mode: 'table', table: '4' } })).status, 201);
  assert.equal((await req('POST', '/api/orders', { body: { ...order, items: [line(coke)], mode: 'delivery', address: 'Home' } })).status, 201);
  // The switch is saved with the item, and turning it off allows delivery.
  const open = await req('PUT', '/api/menu/' + coffee.id, { body: { ...coffee, noDelivery: false } });
  assert.equal(open.json.noDelivery, false);
  assert.equal((await req('POST', '/api/orders', { body: { ...order, mode: 'delivery', address: 'Home' } })).status, 201);
  assert.equal((await req('PUT', '/api/menu/' + coffee.id, { body: coffee })).json.noDelivery, true);
});

it('logout ends the session', async () => {
  assert.equal((await req('POST', '/api/admin/logout', { body: {} })).status, 200);
  assert.equal((await req('GET', '/api/orders')).status, 401);
  cookie = '';
});
