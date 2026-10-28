/* ==========================================================================
   Data access — menu, settings and orders. Rows are returned in the exact
   shape the browser already uses (desc, isPizza, at, …).
   ========================================================================== */
'use strict';
const { pool, tx, insertMenu } = require('./db');
const defaults = require('./defaults');
const validate = require('./validate');
const media = require('./media');

/* ---------- Menu ---------- */
// `r.m_*` columns come from the joined photo (null when the dish has none).
function toItem(r) {
  return {
    id: r.id, category: r.category, name: r.name, diet: r.diet, desc: r.description,
    prices: r.prices, available: r.available, popular: r.popular, isPizza: validate.isPizza(r.category),
    imageId: r.image_id || null,
    art: r.art || '',
    image: r.m_id ? media.toMedia({
      id: r.m_id, alt: r.m_alt, width: r.m_width, height: r.m_height, placeholder: r.m_placeholder,
      sizes: r.m_sizes, in_gallery: r.m_in_gallery, sort_order: r.m_sort_order
    }) : null
  };
}

const ITEM_SELECT = `SELECT i.*, m.id AS m_id, m.alt AS m_alt, m.width AS m_width, m.height AS m_height,
  m.placeholder AS m_placeholder, m.sizes AS m_sizes, m.in_gallery AS m_in_gallery, m.sort_order AS m_sort_order
  FROM menu_items i LEFT JOIN media m ON m.id = i.image_id`;

async function listMenu(client) {
  const { rows } = await (client || pool).query(ITEM_SELECT + ' ORDER BY i.sort_order, i.created_at');
  return rows.map(toItem);
}

async function getItem(c, id) {
  const { rows } = await c.query(ITEM_SELECT + ' WHERE i.id = $1', [id]);
  return toItem(rows[0]);
}

async function upsertItem(raw) {
  const m = validate.item(raw);
  return tx(async (c) => {
    const dupe = await c.query('SELECT name FROM menu_items WHERE lower(name) = lower($1) AND id <> $2', [m.name, m.id]);
    if (dupe.rows.length) validate.fail('An item called “' + dupe.rows[0].name + '” already exists.');
    if (m.imageId && !(await media.exists(m.imageId, c))) validate.fail('That photo was deleted. Choose another one.');
    await c.query(
      `INSERT INTO menu_items (id, category, name, diet, description, prices, available, popular, image_id, art, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM menu_items))
       ON CONFLICT (id) DO UPDATE SET category = EXCLUDED.category, name = EXCLUDED.name, diet = EXCLUDED.diet,
         description = EXCLUDED.description, prices = EXCLUDED.prices, available = EXCLUDED.available,
         popular = EXCLUDED.popular, image_id = EXCLUDED.image_id, art = EXCLUDED.art, updated_at = now()`,
      [m.id, m.category, m.name, m.diet, m.desc, JSON.stringify(m.prices), m.available, m.popular, m.imageId, m.art]
    );
    return getItem(c, m.id);
  });
}

async function deleteItem(id) {
  const { rowCount } = await pool.query('DELETE FROM menu_items WHERE id = $1', [id]);
  return rowCount > 0;
}

async function replaceMenu(list) {
  const clean = validate.menu(list);
  return tx(async (c) => {
    // Imports may name photos that no longer exist here: drop those links.
    const { rows } = await c.query('SELECT id FROM media');
    const known = new Set(rows.map((r) => r.id));
    clean.forEach((m) => { if (m.imageId && !known.has(m.imageId)) m.imageId = null; });
    await c.query('DELETE FROM menu_items');
    await insertMenu(c, clean);
    return listMenu(c);
  });
}

function resetMenu() { return replaceMenu(defaults.MENU); }

/* ---------- Settings ---------- */
async function getSettings() {
  const { rows } = await pool.query('SELECT data FROM settings WHERE id = 1');
  // Merge over defaults so newly added default keys always exist.
  return validate.settings(rows.length ? rows[0].data : {}, defaults.SETTINGS);
}

async function saveSettings(raw) {
  const s = validate.settings(raw, await getSettings());
  await pool.query(
    'INSERT INTO settings (id, data) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()',
    [JSON.stringify(s)]
  );
  return s;
}

function resetSettings() { return saveSettings(defaults.SETTINGS); }

// When the public content (menu or settings) last changed, for sitemap lastmod.
async function contentUpdatedAt() {
  const { rows } = await pool.query(
    'SELECT GREATEST((SELECT MAX(updated_at) FROM menu_items), (SELECT MAX(created_at) FROM menu_items), (SELECT updated_at FROM settings WHERE id = 1), (SELECT MAX(updated_at) FROM media)) AS at'
  );
  return rows[0].at ? new Date(rows[0].at).toISOString() : null;
}

/* ---------- Orders ---------- */
function toOrder(r) {
  return {
    id: Number(r.id), at: new Date(r.created_at).getTime(), name: r.name, phone: r.phone, address: r.address,
    items: r.items, promoCode: r.promo_code, subtotal: r.subtotal, discount: r.discount, delivery: r.delivery, total: r.total,
    status: r.status, outlet: r.outlet || '', mode: r.mode || 'delivery'
  };
}

async function createOrder(o) {
  const { rows } = await pool.query(
    `INSERT INTO orders (name, phone, address, items, promo_code, subtotal, discount, delivery, total, outlet, mode)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [o.name, o.phone, o.address, JSON.stringify(o.items), o.promoCode || null, o.subtotal, o.discount, o.delivery, o.total, o.outlet || '', o.mode || 'delivery']
  );
  return toOrder(rows[0]);
}

// Has this phone number already ordered with this promo code? (Ignores cancelled orders;
// compares the last 10 digits so +977 98..., 98... and spaces all match.)
async function promoUsedBy(phone, code) {
  const digits = String(phone || '').replace(/\D/g, '').slice(-10);
  if (digits.length < 7 || !code) return false;
  const { rows } = await pool.query(
    `SELECT 1 FROM orders WHERE upper(promo_code) = upper($2) AND status <> 'cancelled'
       AND right(regexp_replace(phone, '\\D', '', 'g'), 10) = $1 LIMIT 1`, [digits, String(code)]);
  return rows.length > 0;
}

async function listOrders(limit) {
  const { rows } = await pool.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT $1', [limit || 200]);
  return rows.map(toOrder);
}

const ORDER_STATUSES = ['new', 'preparing', 'delivering', 'done', 'cancelled'];

async function setOrderStatus(id, status) {
  if (!ORDER_STATUSES.includes(status)) validate.fail('Unknown order status.');
  if (!/^\d{1,18}$/.test(String(id))) return null;
  const { rows } = await pool.query('UPDATE orders SET status = $2, updated_at = now() WHERE id = $1 RETURNING *', [id, status]);
  return rows.length ? toOrder(rows[0]) : null;
}

// Customers' names, phones and addresses are only needed while an order is handled.
// After ORDER_DETAILS_DAYS they are blanked; items, totals and dates stay for reports.
const ORDER_DETAILS_DAYS = Math.max(1, Number(process.env.ORDER_DETAILS_DAYS) || 90);
async function forgetOldCustomerDetails() {
  const { rowCount } = await pool.query(
    `UPDATE orders SET name = '', phone = '', address = CASE WHEN address ~* '^(table [\\w-]+|pickup)$' THEN address ELSE '' END
      WHERE created_at < now() - make_interval(days => $1) AND (name <> '' OR phone <> '' OR address !~* '^(table [\\w-]+|pickup|)$')`, [ORDER_DETAILS_DAYS]);
  return rowCount;
}

// Opt-in customer list (see schema.sql). Called only when the customer ticked the box.
const phoneKey = (phone) => String(phone || '').replace(/\D/g, '').slice(-10);
async function rememberCustomer({ name, phone, outlet }) {
  const key = phoneKey(phone);
  if (key.length < 7) return;
  await pool.query(
    `INSERT INTO customers (phone_key, phone, name, outlet) VALUES ($1, $2, $3, $4)
     ON CONFLICT (phone_key) DO UPDATE SET phone = EXCLUDED.phone, name = COALESCE(NULLIF(EXCLUDED.name, ''), customers.name),
       outlet = EXCLUDED.outlet, orders = customers.orders + 1, last_order = now(), consent_at = now()`, [key, phone, name || '', outlet || '']);
}
async function listCustomers() {
  const { rows } = await pool.query('SELECT name, phone, orders, outlet, consent_at, last_order FROM customers ORDER BY last_order DESC');
  return rows;
}
async function forgetCustomer(phone) {
  const key = phoneKey(phone);
  const { rowCount } = await pool.query('DELETE FROM customers WHERE phone_key = $1', [key]);
  return rowCount;
}

async function clearOrders() { await pool.query('TRUNCATE orders'); }

module.exports = {
  listMenu, upsertItem, deleteItem, replaceMenu, resetMenu,
  getSettings, saveSettings, resetSettings, contentUpdatedAt,
  createOrder, listOrders, promoUsedBy, forgetOldCustomerDetails, ORDER_DETAILS_DAYS,
  rememberCustomer, listCustomers, forgetCustomer, phoneKey, setOrderStatus, clearOrders, ORDER_STATUSES
};
