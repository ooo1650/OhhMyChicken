/* ==========================================================================
   JSON API. Public: bootstrap, menu, settings, placing orders.
   Admin (session cookie): menu CMS, settings, passcode, orders log.
   ========================================================================== */
'use strict';
const express = require('express');
const models = require('./models');
const auth = require('./auth');
const defaults = require('./defaults');
const { totals } = require('./pricing');
const { fail } = require('./validate');
const { limit } = require('./limit');

const router = express.Router();
const admin = auth.requireAdmin;

// Everything a page needs for its first render, in one request.
router.get('/bootstrap', async (req, res) => {
  const [menu, settings, updatedAt] = await Promise.all([models.listMenu(), models.getSettings(), models.contentUpdatedAt()]);
  res.json({ defaults: { SIZES: defaults.SIZES, CATEGORIES: defaults.CATEGORIES }, menu, settings, updatedAt });
});

/* ---------- Menu ---------- */
router.get('/menu', async (req, res) => res.json(await models.listMenu()));
router.put('/menu', admin, async (req, res) => res.json(await models.replaceMenu(req.body)));
router.post('/menu/reset', admin, async (req, res) => res.json(await models.resetMenu()));
router.put('/menu/:id', admin, async (req, res) => {
  res.json(await models.upsertItem(Object.assign({}, req.body, { id: req.params.id })));
});
router.delete('/menu/:id', admin, async (req, res) => {
  if (!(await models.deleteItem(req.params.id))) return res.status(404).json({ error: 'Item not found.' });
  res.json({ ok: true });
});

/* ---------- Settings ---------- */
router.get('/settings', async (req, res) => res.json(await models.getSettings()));
router.put('/settings', admin, async (req, res) => res.json(await models.saveSettings(req.body)));
router.post('/settings/reset', admin, async (req, res) => res.json(await models.resetSettings()));

/* ---------- Orders ---------- */
router.post('/orders', limit(20, 10 * 60 * 1000), async (req, res) => {
  const b = req.body || {};
  const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const name = text(b.name, 80), phone = text(b.phone, 30), address = text(b.address, 200);
  if (!name || !phone || !address) fail('Please fill in your name, phone and address.');
  if (!/^[+\d][\d\s-]{6,}$/.test(phone)) fail('Please enter a valid phone number.');
  if (!Array.isArray(b.items) || !b.items.length || b.items.length > 50) fail('Your cart is empty.');
  const cart = b.items.map((c) => ({
    id: String(c && c.id), label: String(c && c.label),
    qty: Math.min(99, Math.max(1, Math.round(Number(c && c.qty)) || 1))
  }));

  const [menu, settings] = await Promise.all([models.listMenu(), models.getSettings()]);
  const t = totals(menu, settings, cart, b.code);
  if (!t.lines.length) fail('Those items are no longer on the menu.');
  const order = await models.createOrder({
    name, phone, address, promoCode: t.discount ? String(b.code).toUpperCase() : null,
    subtotal: t.subtotal, discount: t.discount, delivery: t.delivery, total: t.total,
    items: t.lines.map((l) => ({ id: l.id, name: l.name, label: l.label, qty: l.qty, unit: l.unit, total: l.total }))
  });
  res.status(201).json(order);
});
router.get('/orders', admin, async (req, res) => res.json(await models.listOrders(200)));
router.patch('/orders/:id', admin, async (req, res) => {
  const order = await models.setOrderStatus(req.params.id, req.body && req.body.status);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  res.json(order);
});

// Spreadsheet export. Cells that start with = + - @ are prefixed with ' so
// a customer can't smuggle a formula into Excel through their name or address.
router.get('/orders.csv', admin, async (req, res) => {
  const cell = (v) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const head = ['Order #', 'Date', 'Status', 'Name', 'Phone', 'Address', 'Items', 'Promo', 'Subtotal', 'Discount', 'Delivery', 'Total'];
  const rows = (await models.listOrders(10000)).map((o) => [
    o.id, new Date(o.at).toISOString(), o.status, o.name, o.phone, o.address,
    o.items.map((i) => i.qty + 'x ' + i.name + ' (' + i.label + ')').join('; '),
    o.promoCode || '', o.subtotal, o.discount, o.delivery, o.total
  ]);
  res.type('text/csv').attachment('ohh-my-chicken-orders-' + new Date().toISOString().slice(0, 10) + '.csv')
    .send('\ufeff' + [head].concat(rows).map((r) => r.map(cell).join(',')).join('\r\n'));
});
router.delete('/orders', admin, async (req, res) => { await models.clearOrders(); res.json({ ok: true }); });

/* ---------- Admin session ---------- */
router.get('/admin/session', async (req, res) => res.json(await auth.status(req)));
router.post('/admin/login', limit(30, 15 * 60 * 1000, 'Too many tries. Wait a few minutes and try again.'), auth.login);
router.post('/admin/logout', auth.logout);
router.put('/admin/passcode', admin, auth.changePasscode);

router.use((req, res) => res.status(404).json({ error: 'Not found.' }));

module.exports = router;
