/* ==========================================================================
   Security check: attacks the site from outside, like a visitor would, and
   prints PASS / FAIL / SKIP per check. Node 20+, no dependencies.

     node deploy/test/security-check.mjs http://192.168.122.24

   Optional (env):
     ADMIN_PASSCODE=…   also test photo uploads and admin input validation
     ADMIN_PATH=admin   dashboard path, if you changed it
     ORDERS=1           also flood the order form (creates ~25 test orders;
                        clear them in Dashboard → Orders afterwards)
     BRUTE=1            also guess passcodes. This LOCKS YOUR IP out of the
                        dashboard for 15 minutes, so run it last.
   Exit code 1 if anything failed.
   ========================================================================== */
import zlib from 'node:zlib';

const BASE = (process.argv[2] || process.env.TARGET || '').replace(/\/$/, '');
if (!/^https?:\/\//.test(BASE)) { console.error('Usage: node deploy/test/security-check.mjs http://VM-IP'); process.exit(2); }
const PASS = process.env.ADMIN_PASSCODE || '';
const ADMIN = '/' + (process.env.ADMIN_PATH || 'admin').replace(/^\/+|\/+$/g, '') + '/';
const HTTPS = BASE.startsWith('https://');
const ORIGIN = new URL(BASE).origin;

let pass = 0, fail = 0, skip = 0, cookie = '';
const out = (tag, name, info) => console.log(tag.padEnd(5) + name + (info ? '  [' + info + ']' : ''));
const check = (name, ok, info = '') => { ok ? pass++ : fail++; out(ok ? 'PASS' : 'FAIL', name, info); };
const skipped = (name, why) => { skip++; out('SKIP', name, why); };
const section = (t) => console.log('\n== ' + t);

async function req(method, path, { body, json, headers = {} } = {}) {
  const h = { Origin: ORIGIN, ...headers };
  if (cookie) h.Cookie = cookie;
  if (json !== undefined) { h['Content-Type'] = 'application/json'; body = typeof json === 'string' ? json : JSON.stringify(json); }
  try {
    const r = await fetch(BASE + path, { method, headers: h, body, redirect: 'manual' });
    const text = await r.text();
    return { status: r.status, headers: r.headers, text };
  } catch (e) { return { status: 0, headers: new Headers(), text: String(e.message) }; }
}

/* A valid PNG of any size: tiny file, as big in memory as you like. */
function png(w, h) {
  const T = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; }
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = T[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  const z = zlib.createDeflate({ level: 9 }), parts = []; z.on('data', (d) => parts.push(d));
  const row = Buffer.alloc(1 + w * 3, 0x80); row[0] = 0;
  return new Promise((ok) => {
    z.on('end', () => ok(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', Buffer.concat(parts)), chunk('IEND', Buffer.alloc(0))])));
    for (let y = 0; y < h; y++) z.write(row);
    z.end();
  });
}

console.log('Security check against ' + BASE);

/* ---------- Reachability ---------- */
const home = await req('GET', '/');
if (home.status !== 200) { console.error('\nCannot load ' + BASE + '/ (status ' + home.status + ': ' + home.text.slice(0, 120) + ')'); process.exit(2); }

section('Security headers');
const H = (n) => home.headers.get(n) || '';
check('Content-Security-Policy limits scripts to this site', /script-src 'self'/.test(H('content-security-policy')));
check('Clickjacking protection (X-Frame-Options)', /SAMEORIGIN|DENY/i.test(H('x-frame-options')));
check('No MIME sniffing (X-Content-Type-Options)', H('x-content-type-options') === 'nosniff');
check('Permissions-Policy turns off camera/mic/location', /camera=\(\)/.test(H('permissions-policy')));
check('No X-Powered-By header', !H('x-powered-by'));
check('Server version not revealed', !/\d/.test(H('server')), H('server') || 'no Server header');
if (HTTPS) check('HSTS (HTTPS only)', /max-age=\d{6,}/.test(H('strict-transport-security')));
else skipped('HSTS (HTTPS only)', 'site is plain http');

section('Redirects and hidden pages');
for (const p of ['//evil.example/', '/\\evil.example/', '//Evil.example/x/']) {
  const r = await req('GET', p);
  const loc = r.headers.get('location') || '';
  // Off-site = protocol-relative (//host, /\host) or an absolute URL to another host.
  let offSite = /^\/[\/\\]/.test(loc);
  if (/^https?:/i.test(loc)) { try { offSite = new URL(loc).host !== new URL(BASE).host; } catch (e) { offSite = true; } }
  check('No open redirect via ' + p, !offSite, r.status + (loc ? ' → ' + loc : ''));
}
check('Unknown page is a real 404', (await req('GET', '/this-page-does-not-exist')).status === 404);
check('/admin.html not reachable', (await req('GET', '/admin.html')).status === 404);
const dash = await req('GET', ADMIN);
check('Dashboard page is noindex + no-store', dash.status !== 200 || (/noindex/.test(dash.headers.get('x-robots-tag') || '') && /no-store/.test(dash.headers.get('cache-control') || '')), 'status ' + dash.status);
for (const p of ['/media/../package.json', '/media/%2e%2e/package.json', '/media/.env', '/.env', '/backend/.env', '/.git/config']) {
  const r = await req('GET', p);
  check('No file leak at ' + p, r.status !== 200 || !/(DATABASE_URL|POSTGRES|\[core\]|"dependencies")/.test(r.text), 'status ' + r.status);
}

section('Size limits and bad input');
const longUrl = await req('GET', '/menu?' + 'a'.repeat(20000));
check('20 KB URL refused', [0, 414, 431, 400].includes(longUrl.status), 'status ' + longUrl.status);
check('2 MB JSON body refused', (await req('POST', '/api/orders', { json: { name: 'x'.repeat(2 * 1024 * 1024) } })).status === 413);
check('Broken JSON → 400, not a crash', (await req('POST', '/api/orders', { json: '{"name": ' })).status === 400);
check('Order with bad phone refused', (await req('POST', '/api/orders', { json: { name: 'A', phone: 'call me', address: 'x', items: [{ id: 'm1', label: '12" S', qty: 1 }] } })).status === 400);
check('Order without an outlet refused (when there are several)', [400].includes((await req('POST', '/api/orders', { json: { name: 'A', phone: '+977 9800000000', address: 'x', items: [{ id: 'm1', label: '12" S', qty: 1 }] } })).status));
check('Promo check rejects non-text input', (await req('POST', '/api/promo/check', { json: { code: { $ne: 1 }, phone: ['1'] } })).status === 400);
check('Promo check rejects oversized input', (await req('POST', '/api/promo/check', { json: { code: 'x'.repeat(500), phone: '1' } })).status === 400);
check('Analytics ignores unknown event names', (await req('POST', '/api/t', { json: { events: [{ name: '__proto__', path: '/<script>' }] } })).status === 204);
const proto = await req('GET', '/api/settings');
check('Settings never expose internal fields', !/pass_hash|passcode|token/i.test(proto.text));

section('Access control');
for (const [m, p] of [['GET', '/api/orders'], ['GET', '/api/orders.csv'], ['GET', '/api/media'], ['PUT', '/api/settings'], ['DELETE', '/api/orders'], ['PUT', '/api/menu/m1'],
  ['GET', '/api/admin/security'], ['POST', '/api/admin/sign-out-others'], ['PUT', '/api/admin/passcode'], ['GET', '/api/insights']]) {
  const r = await req(m, p, m === 'GET' ? {} : { json: {} });
  check('Anonymous ' + m + ' ' + p + ' refused', r.status === 401 || r.status === 429, 'status ' + r.status);
}
const sess = await req('GET', '/api/admin/session');
check('Login status doesn\'t reveal if the default passcode is in use', !/defaultPass/.test(sess.text), sess.text.slice(0, 60));
const cross = await req('POST', '/api/admin/login', { json: { passcode: 'x' }, headers: { Origin: 'https://evil.example' } });
check('Cross-site request (CSRF) blocked', cross.status === 403, 'status ' + cross.status);
const form = await req('POST', '/api/admin/login', { body: 'passcode=x', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
check('Form-encoded write refused (JSON only)', form.status === 415 || form.status === 429, 'status ' + form.status);

section('Photo uploads (needs ADMIN_PASSCODE)');
if (!PASS) {
  skipped('Photo upload checks', 'set ADMIN_PASSCODE to run');
} else {
  const login = await req('POST', '/api/admin/login', { json: { passcode: PASS } });
  cookie = (login.headers.get('set-cookie') || '').split(';')[0];
  const sc = login.headers.get('set-cookie') || '';
  check('Admin login works', login.status === 200 && !!cookie, 'status ' + login.status);
  check('Session cookie is HttpOnly + SameSite=Strict', /HttpOnly/i.test(sc) && /SameSite=Strict/i.test(sc));
  if (HTTPS) check('Session cookie is Secure', /Secure/.test(sc)); else skipped('Session cookie is Secure', 'site is plain http');
  if (cookie) {
    const up = (buf, type) => req('POST', '/api/media', { body: buf, headers: { 'Content-Type': type } });
    check('13 MB upload refused', (await up(Buffer.alloc(13 * 1024 * 1024, 1), 'image/png')).status === 413);
    check('Fake image (text file) refused', (await up(Buffer.from('not an image'), 'image/png')).status === 400);
    check('SVG refused (could carry scripts)', (await up(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)" width="900" height="900"/>'), 'image/svg+xml')).status === 400);
    const bomb = await up(await png(9000, 9000), 'image/png');
    check('Image bomb (81 megapixels, tiny file) refused', bomb.status === 400, bomb.text.slice(0, 70));
    const ok = await up(await png(1000, 750), 'image/png');
    check('Normal photo accepted', ok.status === 201, 'status ' + ok.status);
    if (ok.status === 201) await req('DELETE', '/api/media/' + JSON.parse(ok.text).id);
    check('javascript: link refused in settings', (await req('PUT', '/api/settings', { json: { mapsUrl: 'javascript:alert(1)' } })).status === 400);
    check('SQL-style id refused', (await req('PUT', '/api/menu/' + encodeURIComponent("m1' OR 1=1--"), { json: {} })).status === 400);
    await req('POST', '/api/admin/logout', { json: {} });
    cookie = '';
  }
}

section('Order flood (ORDERS=1)');
if (!process.env.ORDERS) {
  skipped('Order flood is rate-limited', 'set ORDERS=1 (creates ~25 test orders)');
} else {
  const menu = JSON.parse((await req('GET', '/api/menu')).text);
  const it = menu.find((m) => m.available) || menu[0];
  const outlet = ((JSON.parse((await req('GET', '/api/settings')).text).outlets || []).find((o) => o.active) || {}).id;
  const order = () => req('POST', '/api/orders', { json: { name: 'Security test ' + 'N'.repeat(500), phone: '+977 9800000000', address: 'TEST ORDER ' + 'A'.repeat(500), outlet, items: [{ id: it.id, label: it.prices[0].label, qty: 100000 }] } });
  const first = await order();
  if (first.status === 201) {
    const o = JSON.parse(first.text);
    check('Long fields cut, quantity capped at 99', o.name.length <= 80 && o.address.length <= 200 && o.items[0].qty === 99);
  }
  const codes = [];
  for (let i = 0; i < 30; i++) codes.push((await order()).status);
  check('Order flood is rate-limited', codes.includes(429), 'first 429 after ' + (codes.indexOf(429) + 1) + ' more');
}

section('Passcode guessing (BRUTE=1, locks your IP for 15 min)');
if (!process.env.BRUTE) {
  skipped('Passcode guessing is locked out', 'set BRUTE=1 (run last)');
} else {
  const codes = [];
  for (let i = 0; i < 14; i++) codes.push((await req('POST', '/api/admin/login', { json: { passcode: 'guess-' + i } })).status);
  check('Passcode guessing is locked out', codes.includes(429), codes.join(','));
  const spoof = [];
  for (let i = 0; i < 4; i++) spoof.push((await req('POST', '/api/admin/login', { json: { passcode: 'g' + i }, headers: { 'X-Forwarded-For': '10.9.8.' + i } })).status);
  check('Faked X-Forwarded-For doesn\'t bypass the lockout', spoof.every((c) => c === 429), spoof.join(','));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed, ' + skip + ' skipped');
process.exit(fail ? 1 : 0);
