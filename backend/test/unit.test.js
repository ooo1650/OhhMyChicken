/* Unit tests: input validation and order pricing (no database needed). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const validate = require('../src/validate');
const { totals } = require('../src/pricing');
const defaults = require('../src/defaults');

const settings = () => validate.settings({}, defaults.SETTINGS);
const menu = defaults.MENU.map((m) => ({ ...m, isPizza: validate.isPizza(m.category) }));
const bbq = menu.find((m) => m.name === 'Chicken BBQ Pizza');
const priceOf = (item, label) => item.prices.find((p) => p.label === label).price;

test('menu item: accepts a valid item and trims text', () => {
  const it = validate.item({ id: 'x1', name: '  Test Pizza ', category: 'veg', diet: 'veg', desc: ' Tasty ', prices: [{ label: '12" S', price: '499.6' }] });
  assert.equal(it.name, 'Test Pizza');
  assert.equal(it.desc, 'Tasty');
  assert.equal(it.prices[0].price, 500);
  assert.equal(it.available, true);
  assert.equal(it.imageId, null);
  assert.equal(it.art, '');
  assert.equal(validate.item({ id: 'x2', name: 'B', category: 'veg', diet: 'veg', art: 'pizza-corn', prices: [{ label: 'R', price: 1 }] }).art, 'pizza-corn');
});

test('menu item: rejects bad input', () => {
  const base = { id: 'x1', name: 'A', category: 'veg', diet: 'veg', prices: [{ label: 'R', price: 100 }] };
  assert.throws(() => validate.item({ ...base, id: '../etc' }), /Invalid item id/);
  assert.throws(() => validate.item({ ...base, category: 'nope' }), /Unknown category/);
  assert.throws(() => validate.item({ ...base, prices: [] }), /at least one price/);
  assert.throws(() => validate.item({ ...base, prices: [{ label: 'R', price: 1 }, { label: 'r', price: 2 }] }), /unique/);
  assert.throws(() => validate.item({ ...base, prices: [{ label: 'R', price: -5 }] }), /between/);
  assert.throws(() => validate.item({ ...base, name: 'x'.repeat(61) }), /at most 60/);
  assert.throws(() => validate.item({ ...base, imageId: 'not-a-photo-id' }), /Invalid photo/);
  assert.throws(() => validate.item({ ...base, art: '<svg onload=x>' }), /Invalid artwork/);
});

test('default menu: every dish has its own picture key', () => {
  assert.ok(defaults.MENU.every((m) => /^[a-z0-9-]+$/.test(m.art)));
});

test('settings: validates and normalises fields', () => {
  const s = validate.settings({ whatsapp: '+977 980-000-0000', promo: { code: 'abc' }, lat: '27.7', socialLinks: 'https://facebook.com/x\nhttps://instagram.com/y' }, defaults.SETTINGS);
  assert.equal(s.whatsapp, '9779800000000');
  assert.equal(s.promo.code, 'ABC');
  assert.equal(s.lat, 27.7);
  assert.equal(s.lng, null);
  assert.deepEqual(s.socialLinks, ['https://facebook.com/x', 'https://instagram.com/y']);
  assert.throws(() => validate.settings({ hoursOpen: '25:00' }, defaults.SETTINGS), /HH:MM/);
  assert.throws(() => validate.settings({ lat: 91 }, defaults.SETTINGS), /Latitude/);
  assert.throws(() => validate.settings({ mapsUrl: 'javascript:alert(1)' }, defaults.SETTINGS), /web link/);
  assert.throws(() => validate.settings({ promo: { percent: 95 } }, defaults.SETTINGS), /Promo %/);
});

test('pricing: totals come from the menu, not the client', () => {
  const t = totals(menu, settings(), [{ id: bbq.id, label: '12" S', qty: 2 }], '');
  assert.equal(t.subtotal, priceOf(bbq, '12" S') * 2);
  assert.equal(t.total, t.subtotal + (t.subtotal >= defaults.SETTINGS.freeDeliveryOver ? 0 : defaults.SETTINGS.deliveryFee));
});

test('pricing: unknown items and variants are dropped', () => {
  const t = totals(menu, settings(), [{ id: 'nope', label: 'x', qty: 1 }, { id: bbq.id, label: '99" giant', qty: 1 }], '');
  assert.equal(t.lines.length, 0);
  assert.equal(t.total, 0);
});

test('pricing: promo takes % off the priciest 22" pizza only', () => {
  const s = settings();
  const cart = [{ id: bbq.id, label: '22" XL', qty: 1 }, { id: bbq.id, label: '12" S', qty: 1 }];
  const t = totals(menu, s, cart, s.promo.code.toLowerCase());
  assert.equal(t.discount, Math.round(priceOf(bbq, '22" XL') * s.promo.percent / 100));
  assert.equal(totals(menu, s, cart, 'WRONG').discount, 0);
  assert.equal(totals(menu, s, [{ id: bbq.id, label: '12" S', qty: 3 }], s.promo.code).discount, 0);
  assert.equal(totals(menu, { ...s, promo: { ...s.promo, enabled: false } }, cart, s.promo.code).discount, 0);
});

test('pricing: free delivery over the threshold', () => {
  const s = settings();
  const big = totals(menu, s, [{ id: bbq.id, label: '22" XL', qty: 5 }], '');
  assert.equal(big.delivery, 0);
  const small = totals(menu, { ...s, freeDeliveryOver: 1e9 }, [{ id: bbq.id, label: '12" S', qty: 1 }], '');
  assert.equal(small.delivery, s.deliveryFee);
});

test('rate limits: an IPv6 /64 counts as one client', () => {
  const { clientKey } = require('../src/limit');
  assert.equal(clientKey('2001:db8:abcd:12::1'), clientKey('2001:db8:abcd:12:ffff::9'));
  assert.notEqual(clientKey('2001:db8:abcd:12::1'), clientKey('2001:db8:abcd:13::1'));
  assert.equal(clientKey('::ffff:203.0.113.5'), '203.0.113.5');
});

test('load gate: runs a few at a time, refuses beyond its queue with 503', async () => {
  const { createGate } = require('../src/limit');
  const gate = createGate(2, 3);
  let running = 0, peak = 0;
  const task = () => gate.run(async () => { running++; peak = Math.max(peak, running); await new Promise((r) => setTimeout(r, 20)); running--; return 'ok'; });
  const results = await Promise.allSettled(Array.from({ length: 8 }, task));
  assert.equal(peak, 2);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 5);
  assert.ok(results.filter((r) => r.status === 'rejected').every((r) => r.reason.status === 503));
});

test('passcode strength: length, variety, no restaurant or place names', () => {
  const { weakness } = require('../src/passcode');
  assert.match(weakness('short1'), /at least 10/);
  assert.match(weakness('aaaaaaaaaaaa'), /different characters/);
  for (const p of ['pizza12345', 'Ohhmychicken2026!', 'Kathmandu123456', 'password1234']) assert.match(weakness(p), /Too easy/, p);
  for (const p of ['red-door-momo-42', 'kitchen-door-blue-77', '4829173650']) assert.equal(weakness(p), '', p);
});

test('text cleaning: hidden characters removed, Nepali and emoji kept', () => {
  const { clean } = validate;
  assert.equal(clean('‮evil‬ name\u0000​  x\r\ny'), 'evil name x y');
  assert.equal(clean('a\r\n\n\n\nb', { multiline: true }), 'a\n\nb');
  assert.equal(clean('नेपाली क्ष‍ 👨‍👩‍👧'), 'नेपाली क्ष‍ 👨‍👩‍👧');
  const it = validate.item({ id: 'x3', name: ' Spicy‮ Wings ', category: 'special', diet: 'chicken', desc: 'Hot\n\n\n\nwings', prices: [{ label: '6 pcs', price: 1 }] });
  assert.equal(it.name, 'Spicy Wings');
  assert.equal(it.desc, 'Hot\n\nwings');
});
