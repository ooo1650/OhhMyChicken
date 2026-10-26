/* SEO module: routes, title/description limits, schema.org data, escaping. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolveRoute, pageMeta, jsonLd, faqs, meals, safeJson, headHtml, categoryPath } from '../src/shared/seo.js';

// The real factory defaults from the backend, so tests follow menu changes.
const require = createRequire(import.meta.url);
const d = require('../../backend/src/defaults.js');
const isPizza = (c) => d.PIZZA_CATEGORIES.includes(c);
const boot = (over = {}) => ({
  defaults: { SIZES: d.SIZES, CATEGORIES: d.CATEGORIES },
  menu: d.MENU.map((m) => ({ ...m, isPizza: isPizza(m.category), image: null })),
  settings: { ...d.SETTINGS, ...over },
  gallery: []
});
const ORIGIN = 'https://example.com';
const allRoutes = (b) => ['/', '/menu', ...b.defaults.CATEGORIES.map(categoryPath)].map((p) => resolveRoute(p, b.defaults.CATEGORIES));

test('routes: pages, aliases and 404s', () => {
  const cats = d.CATEGORIES;
  assert.equal(resolveRoute('/', cats).view, 'home');
  assert.deepEqual(resolveRoute('/find', cats), { view: 'home', section: 'find', path: '/find', canonical: '/' });
  assert.equal(resolveRoute('/menu/', cats).canonical, '/menu');
  assert.equal(resolveRoute('/menu/chicken-pizza', cats).cat.id, 'nonveg');
  assert.equal(resolveRoute('/menu/nope', cats).view, 'notfound');
  assert.equal(resolveRoute('/admin.html', cats).canonical, null);
});

test('every page: title ≤ 60 and description ≤ 160 characters, unique', () => {
  for (const city of ['Kathmandu', 'Lalitpur']) {
    const b = boot({ city });
    const titles = new Set();
    for (const r of allRoutes(b)) {
      const m = pageMeta(r, b);
      assert.ok(m.title.length <= 60, r.path + ' title ' + m.title.length + ': ' + m.title);
      assert.ok(m.description.length <= 160, r.path + ' description ' + m.description.length);
      assert.ok(m.description.length >= 70, r.path + ' description too short');
      assert.ok(m.title.includes(city) || r.path === '/menu', r.path + ' title names the city');
      titles.add(m.title);
    }
    assert.equal(titles.size, allRoutes(b).length, 'titles are unique');
  }
});

test('meals follow opening hours (including past midnight)', () => {
  assert.deepEqual(meals({ hoursOpen: '10:00', hoursClose: '22:00' }), ['lunch', 'dinner']);
  assert.deepEqual(meals({ hoursOpen: '17:00', hoursClose: '23:00' }), ['dinner']);
  assert.deepEqual(meals({ hoursOpen: '11:00', hoursClose: '15:00' }), ['lunch']);
  assert.deepEqual(meals({ hoursOpen: '18:00', hoursClose: '02:00' }), ['dinner']);
});

test('structured data: Restaurant everywhere, Menu with every dish, FAQ on home', () => {
  const b = boot({ lat: 27.7, lng: 85.3, socialLinks: ['https://facebook.com/x'] });
  const home = jsonLd(resolveRoute('/', b.defaults.CATEGORIES), b, ORIGIN)['@graph'];
  const r = home.find((g) => g['@type'] === 'Restaurant');
  assert.equal(r.url, ORIGIN + '/');
  assert.equal(r.geo.latitude, 27.7);
  assert.deepEqual(r.sameAs, ['https://facebook.com/x']);
  assert.equal(home.find((g) => g['@type'] === 'FAQPage').mainEntity.length, faqs(b).length);

  const menu = jsonLd(resolveRoute('/menu', b.defaults.CATEGORIES), b, ORIGIN)['@graph'].find((g) => g['@type'] === 'Menu');
  const items = menu.hasMenuSection.flatMap((s) => s.hasMenuItem);
  assert.equal(items.length, b.menu.length);
  assert.ok(items.every((i) => i.offers.every((o) => o.priceCurrency === 'NPR' && Number(o.price) >= 0)));
});

test('head html: escapes values and makes JSON safe inside <script>', () => {
  const b = boot({ name: 'Evil "</script><script>alert(1)</script>' });
  const html = headHtml(resolveRoute('/', b.defaults.CATEGORIES), b, ORIGIN);
  assert.ok(!html.includes('</script><script>alert'), 'no script injection');
  assert.ok(!safeJson({ x: '</script>' }).includes('</'));
  assert.ok(html.includes('<link rel="canonical" href="https://example.com/">'));
});

test('404 pages are noindex and carry no structured data', () => {
  const b = boot();
  const html = headHtml(resolveRoute('/nope', b.defaults.CATEGORIES), b, ORIGIN);
  assert.match(html, /noindex/);
  assert.doesNotMatch(html, /ld\+json/);
  assert.doesNotMatch(html, /rel="canonical"/);
});
