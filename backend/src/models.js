/* ==========================================================================
   Data access — menu, settings and orders. Rows are returned in the exact
   shape the browser already uses (desc, isPizza, at, …).
   ========================================================================== */
'use strict';
const { pool, tx, insertMenu } = require('./db');
const defaults = require('./defaults');
const validate = require('./validate');

/* ---------- Menu ---------- */
function toItem(r) {
  return {
    id: r.id, category: r.category, name: r.name, diet: r.diet, desc: r.description,
    prices: r.prices, available: r.available, popular: r.popular, isPizza: validate.isPizza(r.category)
  };
}

async function listMenu(client) {
  const { rows } = await (client || pool).query('SELECT * FROM menu_items ORDER BY sort_order, created_at');
  return rows.map(toItem);
}

async function upsertItem(raw) {
  const m = validate.item(raw);
  return tx(async (c) => {
    const dupe = await c.query('SELECT name FROM menu_items WHERE lower(name) = lower($1) AND id <> $2', [m.name, m.id]);
    if (dupe.rows.length) validate.fail('An item called “' + dupe.rows[0].name + '” already exists.');
    const { rows } = await c.query(
      `INSERT INTO menu_items (id, category, name, diet, description, prices, available, popular, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM menu_items))
       ON CONFLICT (id) DO UPDATE SET category = EXCLUDED.category, name = EXCLUDED.name, diet = EXCLUDED.diet,
         description = EXCLUDED.description, prices = EXCLUDED.prices, available = EXCLUDED.available,
         popular = EXCLUDED.popular, updated_at = now()
       RETURNING *`,
      [m.id, m.category, m.name, m.diet, m.desc, JSON.stringify(m.prices), m.available, m.popular]
    );
    return toItem(rows[0]);
  });
}

async function deleteItem(id) {
  const { rowCount } = await pool.query('DELETE FROM menu_items WHERE id = $1', [id]);
  return rowCount > 0;
}

async function replaceMenu(list) {
  const clean = validate.menu(list);
  return tx(async (c) => {
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
    'SELECT GREATEST((SELECT MAX(updated_at) FROM menu_items), (SELECT MAX(created_at) FROM menu_items), (SELECT updated_at FROM settings WHERE id = 1)) AS at'
  );
  return rows[0].at ? new Date(rows[0].at).toISOString() : null;
}

/* ---------- Orders ---------- */
function toOrder(r) {
  return {
    id: Number(r.id), at: new Date(r.created_at).getTime(), name: r.name, phone: r.phone, address: r.address,
    items: r.items, promoCode: r.promo_code, subtotal: r.subtotal, discount: r.discount, delivery: r.delivery, total: r.total,
    status: r.status
  };
}

async function createOrder(o) {
  const { rows } = await pool.query(
    `INSERT INTO orders (name, phone, address, items, promo_code, subtotal, discount, delivery, total)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [o.name, o.phone, o.address, JSON.stringify(o.items), o.promoCode || null, o.subtotal, o.discount, o.delivery, o.total]
  );
  return toOrder(rows[0]);
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

async function clearOrders() { await pool.query('TRUNCATE orders'); }

module.exports = {
  listMenu, upsertItem, deleteItem, replaceMenu, resetMenu,
  getSettings, saveSettings, resetSettings, contentUpdatedAt,
  createOrder, listOrders, setOrderStatus, clearOrders, ORDER_STATUSES
};
