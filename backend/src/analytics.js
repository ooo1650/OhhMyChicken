/* ==========================================================================
   Privacy-friendly analytics. What visitors do on the site, stored without
   anything that identifies them:
   - no cookies, no IP addresses, no user-agent strings are stored;
   - a visitor is a hash of IP + browser + a salt that changes every day and
     is then deleted, so visits can be counted per day but never linked to a
     person or followed across days (not even by us);
   - "Do Not Track" / Global Privacy Control and bots are ignored entirely;
   - raw events are deleted after ANALYTICS_RETENTION_DAYS (default 180).
   ========================================================================== */
'use strict';
const crypto = require('crypto');
const { pool } = require('./db');
const { fail, clean } = require('./validate');

const TZ = process.env.ANALYTICS_TZ || 'Asia/Kathmandu';
const RETENTION_DAYS = Math.max(7, Number(process.env.ANALYTICS_RETENTION_DAYS) || 180);
const MAX_BATCH = 20;

// What the site may send, and which fields each event can carry.
const EVENTS = {
  page_view: ['path', 'referrer', 'table_no'],
  search: ['value', 'num'],
  cat_click: ['category'],
  diet_filter: ['value'],
  add_to_cart: ['item_id', 'value', 'num'],
  cart_open: [],
  checkout_submit: ['num'],
  promo_shown: [],
  promo_copied: [],
  promo_applied: ['value'],
  chat_open: [],
  gallery_open: [],
  size_select: ['value']
};

const BOT_RE = /bot|crawl|spider|slurp|lighthouse|headless|curl|wget|python|go-http|java\/|axios|node-fetch|k6\/|httpclient|monitor|preview/i;

/* ---------- Who (anonymously) ---------- */
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
let saltCache = { day: '', salt: '' };

async function dailySalt() {
  const day = today();
  if (saltCache.day === day) return saltCache.salt;
  await pool.query('INSERT INTO analytics_salt (day, salt) VALUES ($1, $2) ON CONFLICT (day) DO NOTHING', [day, crypto.randomBytes(32).toString('hex')]);
  const { rows } = await pool.query('SELECT salt FROM analytics_salt WHERE day = $1', [day]);
  await pool.query('DELETE FROM analytics_salt WHERE day < $1', [day]); // yesterday's hashes can no longer be recreated
  saltCache = { day, salt: rows[0].salt };
  return saltCache.salt;
}

function allowed(req) {
  if (req.get('dnt') === '1' || req.get('sec-gpc') === '1') return false;
  return !BOT_RE.test(req.get('user-agent') || '');
}

async function visitorOf(req) {
  const salt = await dailySalt();
  return crypto.createHash('sha256').update(salt + '|' + (req.ip || '') + '|' + (req.get('user-agent') || '')).digest('hex').slice(0, 16);
}

function deviceOf(req) {
  const ua = req.get('user-agent') || '';
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) return 'tablet';
  if (/Mobi|iPhone|Android/i.test(ua)) return 'mobile';
  return 'desktop';
}

/* ---------- Cleaning each field ---------- */
const text = (v, max) => (typeof v === 'string' ? Array.from(clean(v)).slice(0, max).join('') : null) || null;
const CLEAN = {
  path: (v) => { const p = text(v, 120); return p && p.startsWith('/') ? p.split('?')[0].split('#')[0].toLowerCase() : null; },
  item_id: (v) => { const s = text(v, 40); return s && /^[\w-]+$/.test(s) ? s : null; },
  category: (v) => { const s = text(v, 20); return s && /^[a-z0-9-]+$/.test(s) ? s : null; },
  // Free text: lower-case, and long digit runs (phone numbers) masked.
  value: (v) => { const s = text(v, 80); return s ? s.toLowerCase().replace(/\d{4,}/g, '###') : null; },
  num: (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(10000000, Math.round(Number(v)))) : null),
  referrer: (v) => { const s = text(v, 100); return s && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(s) ? s.toLowerCase().replace(/^www\./, '') : null; },
  table_no: (v) => { const s = text(String(v || ''), 6); return s && /^[\w-]+$/.test(s) ? s : null; }
};
const COLUMNS = ['path', 'item_id', 'category', 'value', 'num', 'referrer', 'table_no'];

async function insert(rows) {
  if (!rows.length) return;
  const vals = [], marks = rows.map((r, i) => {
    const base = i * 10;
    vals.push(r.visitor, r.name, r.device, ...COLUMNS.map((c) => (r[c] === undefined ? null : r[c])));
    return '(' + Array.from({ length: 10 }, (_, k) => '$' + (base + k + 1)).join(',') + ')';
  });
  await pool.query('INSERT INTO events (visitor, name, device, ' + COLUMNS.join(', ') + ') VALUES ' + marks.join(','), vals);
}

/** POST /api/t — a batch of events from the site. */
async function collect(req) {
  if (!allowed(req)) return 0;
  const list = req.body && req.body.events;
  if (!Array.isArray(list) || !list.length) fail('No events.');
  if (list.length > MAX_BATCH) fail('Too many events.');
  const visitor = await visitorOf(req), device = deviceOf(req);
  const rows = [];
  for (const e of list) {
    if (!e || typeof e !== 'object' || !Object.prototype.hasOwnProperty.call(EVENTS, e.name)) continue; // unknown names are dropped
    const row = { visitor, device, name: e.name };
    for (const f of EVENTS[e.name]) row[f] = CLEAN[f](e[f]);
    rows.push(row);
  }
  await insert(rows);
  return rows.length;
}

/** Server-side events (e.g. an order was placed), same anonymous visitor. */
async function recordServer(req, name, fields) {
  try {
    if (!allowed(req)) return;
    await insert([{ visitor: await visitorOf(req), device: deviceOf(req), name, ...fields }]);
  } catch (e) { console.warn('analytics:', e.message); } // never break the real request
}

/* ---------- Housekeeping ---------- */
async function cleanup() {
  await pool.query("DELETE FROM events WHERE at < now() - make_interval(days => $1)", [RETENTION_DAYS]);
}
function startCleanup() {
  cleanup().catch((e) => console.warn('analytics cleanup:', e.message));
  setInterval(() => cleanup().catch(() => {}), 6 * 3600 * 1000).unref();
}

/* ---------- Insights for the dashboard ---------- */
async function insights(daysRaw) {
  const days = [7, 30, 90].includes(Number(daysRaw)) ? Number(daysRaw) : 30;
  const P = [days, TZ];
  const SINCE = "at >= date_trunc('day', now() AT TIME ZONE $2) AT TIME ZONE $2 - make_interval(days => $1 - 1)";
  const OSINCE = SINCE.replace(/\bat\b/, 'created_at');
  const q = (sql, params = P) => pool.query(sql, params).then((r) => r.rows);

  const [totals, orderTotals, daily, funnel, adds, ordered, searches, empty, hours, orderHours, referrers, devices, landing, tables, promo, promoOrders, cats] = await Promise.all([
    q(`SELECT count(DISTINCT visitor)::int AS visits, count(*) FILTER (WHERE name = 'page_view')::int AS pageviews FROM events WHERE ${SINCE}`),
    q(`SELECT count(*)::int AS orders, COALESCE(sum(total), 0)::int AS revenue FROM orders WHERE status <> 'cancelled' AND ${OSINCE}`),
    q(`WITH d AS (SELECT generate_series(date_trunc('day', now() AT TIME ZONE $2) - make_interval(days => $1 - 1), date_trunc('day', now() AT TIME ZONE $2), '1 day')::date AS day)
       SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
         (SELECT count(DISTINCT visitor) FROM events e WHERE (e.at AT TIME ZONE $2)::date = d.day)::int AS visits,
         (SELECT count(*) FROM orders o WHERE o.status <> 'cancelled' AND (o.created_at AT TIME ZONE $2)::date = d.day)::int AS orders
       FROM d ORDER BY d.day`),
    q(`SELECT count(DISTINCT visitor)::int AS visited,
         count(DISTINCT visitor) FILTER (WHERE name = 'page_view' AND path LIKE '/menu%')::int AS menu,
         count(DISTINCT visitor) FILTER (WHERE name = 'add_to_cart')::int AS added,
         count(DISTINCT visitor) FILTER (WHERE name = 'cart_open')::int AS cart,
         count(DISTINCT visitor) FILTER (WHERE name = 'checkout_submit')::int AS checkout,
         count(DISTINCT visitor) FILTER (WHERE name = 'order_placed')::int AS ordered
       FROM events WHERE ${SINCE}`),
    q(`SELECT item_id, count(*)::int AS adds FROM events WHERE name = 'add_to_cart' AND item_id IS NOT NULL AND ${SINCE} GROUP BY item_id ORDER BY adds DESC LIMIT 30`),
    q(`SELECT i->>'id' AS item_id, sum((i->>'qty')::int)::int AS qty FROM orders, jsonb_array_elements(items) i WHERE status <> 'cancelled' AND ${OSINCE} GROUP BY 1`),
    q(`SELECT value AS query, count(*)::int AS times, round(avg(num))::int AS results FROM events WHERE name = 'search' AND value IS NOT NULL AND ${SINCE} GROUP BY value ORDER BY times DESC LIMIT 10`),
    q(`SELECT value AS query, count(*)::int AS times FROM events WHERE name = 'search' AND num = 0 AND value IS NOT NULL AND ${SINCE} GROUP BY value ORDER BY times DESC LIMIT 10`),
    q(`SELECT extract(hour FROM at AT TIME ZONE $2)::int AS hour, count(DISTINCT visitor)::int AS visits FROM events WHERE ${SINCE} GROUP BY 1`),
    q(`SELECT extract(hour FROM created_at AT TIME ZONE $2)::int AS hour, count(*)::int AS orders FROM orders WHERE status <> 'cancelled' AND ${OSINCE} GROUP BY 1`),
    q(`SELECT referrer, count(DISTINCT visitor)::int AS visits FROM events WHERE name = 'page_view' AND referrer IS NOT NULL AND ${SINCE} GROUP BY referrer ORDER BY visits DESC LIMIT 8`),
    q(`SELECT device, count(DISTINCT visitor)::int AS visits FROM events WHERE ${SINCE} GROUP BY device ORDER BY visits DESC`),
    q(`SELECT path, count(*)::int AS visits FROM (SELECT DISTINCT ON (visitor) path FROM events WHERE name = 'page_view' AND ${SINCE} ORDER BY visitor, at) f GROUP BY path ORDER BY visits DESC LIMIT 8`),
    q(`SELECT table_no, count(DISTINCT visitor) FILTER (WHERE name = 'page_view')::int AS scans, count(*) FILTER (WHERE name = 'order_placed')::int AS orders
       FROM events WHERE table_no IS NOT NULL AND ${SINCE} GROUP BY table_no ORDER BY scans DESC LIMIT 20`),
    q(`SELECT count(*) FILTER (WHERE name = 'promo_shown')::int AS shown, count(*) FILTER (WHERE name = 'promo_copied')::int AS copied,
         count(*) FILTER (WHERE name = 'promo_applied')::int AS applied FROM events WHERE ${SINCE}`),
    q(`SELECT count(*)::int AS orders FROM orders WHERE promo_code IS NOT NULL AND status <> 'cancelled' AND ${OSINCE}`),
    q(`SELECT category, count(*)::int AS clicks FROM events WHERE name = 'cat_click' AND ${SINCE} GROUP BY category ORDER BY clicks DESC`)
  ]);

  const orderedBy = Object.fromEntries(ordered.map((r) => [r.item_id, r.qty]));
  const t = totals[0], o = orderTotals[0];
  return {
    days, timezone: TZ,
    totals: { visits: t.visits, pageviews: t.pageviews, orders: o.orders, revenue: o.revenue, conversion: t.visits ? funnel[0].ordered / t.visits : 0 },
    daily, funnel: funnel[0],
    items: adds.map((a) => ({ itemId: a.item_id, adds: a.adds, ordered: orderedBy[a.item_id] || 0 })),
    searches, emptySearches: empty,
    hours: Array.from({ length: 24 }, (_, h) => ({ hour: h, visits: (hours.find((x) => x.hour === h) || {}).visits || 0, orders: (orderHours.find((x) => x.hour === h) || {}).orders || 0 })),
    referrers, devices, landing, tables,
    promo: { ...promo[0], orders: promoOrders[0].orders },
    categories: cats
  };
}

module.exports = { collect, recordServer, insights, startCleanup, EVENTS };
