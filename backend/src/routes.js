/* ==========================================================================
   JSON API. Public: bootstrap, menu, settings, placing orders.
   Admin (session cookie): menu CMS, settings, passcode, orders log.
   ========================================================================== */
'use strict';
const express = require('express');
const models = require('./models');
const media = require('./media');
const analytics = require('./analytics');
const auth = require('./auth');
const defaults = require('./defaults');
const { totals } = require('./pricing');
const validate = require('./validate');
const { fail } = validate;
const { limit } = require('./limit');

const router = express.Router();
const admin = auth.requireAdmin;

// Public reads (menu, settings, gallery) are the same for everyone: keep them
// for 2 s so a flood of page loads can't turn into a flood of database queries.
// Any successful write clears the cache.
const cache = new Map();
const CACHE_MS = 2000;
function cached(key, load) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = load();
  cache.set(key, { at: Date.now(), value });
  value.catch(() => cache.delete(key));
  return value;
}
router.use((req, res, next) => {
  // Only changes to what visitors see clear it (not orders or analytics beacons).
  if (req.method !== 'GET' && req.method !== 'HEAD' && /^\/(menu|settings|media)\b/.test(req.path)) {
    res.on('finish', () => { if (res.statusCode < 400) cache.clear(); });
  }
  next();
});

// Everything a page needs for its first render, in one request.
router.get('/bootstrap', async (req, res) => {
  const [menu, settings, gallery, updatedAt, hero] = await cached('bootstrap', async () => {
    const s = await models.getSettings();
    const [m, g, u, h] = await Promise.all([models.listMenu(), media.listGallery(), models.contentUpdatedAt(), media.getOne(s.heroImageId)]);
    return [m, s, g, u, h];
  });
  res.json({ defaults: { SIZES: defaults.SIZES, CATEGORIES: defaults.CATEGORIES, ORDER_DETAILS_DAYS: models.ORDER_DETAILS_DAYS }, menu, settings, gallery, hero, updatedAt });
});

/* ---------- Menu ---------- */
router.get('/menu', async (req, res) => res.json(await cached('menu', () => models.listMenu())));
router.put('/menu', admin, async (req, res) => res.json(await models.replaceMenu(req.body)));
router.post('/menu/reset', admin, async (req, res) => res.json(await models.resetMenu()));
router.put('/menu/:id', admin, async (req, res) => {
  res.json(await models.upsertItem(Object.assign({}, req.body, { id: req.params.id })));
});
router.delete('/menu/:id', admin, async (req, res) => {
  if (!(await models.deleteItem(req.params.id))) return res.status(404).json({ error: 'Item not found.' });
  res.json({ ok: true });
});

/* ---------- Photos ---------- */
// Upload: the raw image is the body (Content-Type image/*); the original
// file name comes URL-encoded in X-File-Name.
router.get('/media', admin, async (req, res) => res.json(await media.listAll()));
router.post('/media', admin, limit(60, 10 * 60 * 1000, 'Too many uploads. Wait a few minutes.'),
  express.raw({ type: 'image/*', limit: media.MAX_BYTES }),
  async (req, res) => {
    let name = '';
    try { name = decodeURIComponent(req.get('x-file-name') || ''); } catch (e) { /* keep empty */ }
    res.status(201).json(await media.create(req.body, name));
  });
router.put('/media/order', admin, async (req, res) => res.json(await media.reorderGallery(req.body && req.body.ids)));
router.patch('/media/:id', admin, async (req, res) => {
  const m = await media.update(req.params.id, req.body);
  if (!m) return res.status(404).json({ error: 'Photo not found.' });
  res.json(m);
});
router.delete('/media/:id', admin, async (req, res) => {
  if (!(await media.remove(req.params.id))) return res.status(404).json({ error: 'Photo not found.' });
  res.json({ ok: true });
});

/* ---------- Analytics (anonymous; see analytics.js) ---------- */
// Beacons from the site. 204 either way: a visitor's browser never needs to know.
router.post('/t', limit(60, 60 * 1000), async (req, res) => { await analytics.collect(req); res.status(204).end(); });
router.get('/insights', admin, async (req, res) => res.json(await analytics.insights(req.query.days)));

/* ---------- Settings ---------- */
router.get('/settings', async (req, res) => res.json(await cached('settings', () => models.getSettings())));
router.put('/settings', admin, async (req, res) => res.json(await models.saveSettings(req.body)));
router.post('/settings/reset', admin, async (req, res) => res.json(await models.resetSettings()));

/* ---------- Orders ---------- */
// Orders per IP per 10 minutes (ORDER_LIMIT; tests raise it).
const ORDER_LIMIT = Number(process.env.ORDER_LIMIT) || 20;
router.post('/orders', limit(ORDER_LIMIT, 10 * 60 * 1000), async (req, res) => {
  const b = req.body || {};
  const text = (v, max) => (typeof v === 'string' ? Array.from(validate.clean(v)).slice(0, max).join('') : '');
  // Only what the order needs: an address for delivery, a table number at a table.
  // Name and phone are optional (WhatsApp shows the outlet the customer's number anyway).
  const MODES = ['delivery', 'pickup', 'table'];
  const mode = MODES.includes(b.mode) ? b.mode : 'delivery';
  const name = text(b.name, 80), phone = text(b.phone, 30);
  let address = text(b.address, 200);
  if (phone && !/^[+\d][\d\s-]{6,}$/.test(phone)) fail('Please enter a valid phone number, or leave it empty.');
  if (!Array.isArray(b.items) || !b.items.length || b.items.length > 50) fail('Your cart is empty.');
  const cart = b.items.map((c) => ({
    id: String(c && c.id), label: String(c && c.label),
    qty: Math.min(99, Math.max(1, Math.round(Number(c && c.qty)) || 1))
  }));

  const [menu, settings] = await Promise.all([models.listMenu(), models.getSettings()]);
  if (mode === 'pickup' && !settings.takeaway) fail('Pickup is not available. Choose delivery.');
  if (mode === 'table' && !settings.dineIn) fail('Table orders are not available.');
  if (mode === 'table') {
    const tableNo = text(b.table, 6);
    if (!/^[\w-]{1,6}$/.test(tableNo)) fail('Please enter your table number.');
    address = 'Table ' + tableNo;
  } else if (mode === 'pickup') address = 'Pickup';
  else if (!address) fail('Please enter your delivery address.');
  let t = totals(menu, settings, cart, b.code, mode);
  if (!t.lines.length) fail('Those items are no longer on the menu.');
  // The promo is once per customer: a phone number that already used it pays full price.
  if (t.discount > 0 && (!phone || !name)) fail('Add your name and phone number to use the promo code (it works once per number).');
  const promoRejected = t.discount > 0 && await models.promoUsedBy(phone, b.code);
  if (promoRejected) t = totals(menu, settings, cart, '', mode);
  // With branches, the order names the one it was sent to.
  const open = settings.outlets.filter((o) => o.active);
  let outlet = '';
  if (open.length) {
    const o = open.find((x) => x.id === b.outlet) || (open.length === 1 ? open[0] : null);
    if (!o) fail('Please choose an outlet for your order.');
    outlet = o.name;
  }
  const order = await models.createOrder({
    name, phone, address, outlet, mode, promoCode: t.discount ? String(b.code).toUpperCase() : null,
    subtotal: t.subtotal, discount: t.discount, delivery: t.delivery, total: t.total,
    items: t.lines.map((l) => ({ id: l.id, name: l.name, label: l.label, qty: l.qty, unit: l.unit, total: l.total }))
  });
  // Opt-in only: the customer ticked "keep my details" (never pre-ticked).
  if (b.saveDetails === true && phone) {
    await models.rememberCustomer({ name, phone, outlet }).catch((e) => console.warn('customers:', e.message));
  }
  const table = /^table\s+([\w-]{1,6})$/i.exec(address);
  analytics.recordServer(req, 'order_placed', { num: t.total, table_no: table ? table[1] : null });
  res.status(201).json(promoRejected ? { ...order, promoRejected: true } : order);
});

// Lets the cart say "already used" before the customer sends their order.
router.post('/promo/check', limit(30, 10 * 60 * 1000), async (req, res) => {
  const b = req.body || {};
  if (typeof b.code !== 'string' || typeof b.phone !== 'string' || b.code.length > 20 || b.phone.length > 30) fail('Invalid request.');
  res.json({ used: await models.promoUsedBy(b.phone, b.code) });
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
  const head = ['Order #', 'Date', 'Status', 'Outlet', 'Type', 'Name', 'Phone', 'Address', 'Items', 'Promo', 'Subtotal', 'Discount', 'Delivery', 'Total'];
  const rows = (await models.listOrders(10000)).map((o) => [
    o.id, new Date(o.at).toISOString(), o.status, o.outlet, o.mode, o.name, o.phone, o.address,
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
router.post('/admin/sign-out-others', admin, auth.signOutOthers);
router.get('/admin/security', admin, auth.security);

router.use((req, res) => res.status(404).json({ error: 'Not found.' }));

module.exports = router;
