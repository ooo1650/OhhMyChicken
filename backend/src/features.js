/* ==========================================================================
   Features the site administrator switches on or off in Team → Features,
   with no code change or redeploy. To add one: an entry here, then check it
   where it matters (features.on('id') on the server; `features` in the
   bootstrap data on the website, for the public ones).
   ========================================================================== */
'use strict';
const { pool } = require('./db');

const LIST = {
  insights: {
    label: 'Insights for staff', public: false,
    help: 'Visits, orders and what customers look for (Insights tab). The administrator always sees it.',
    default: () => process.env.INSIGHTS_ENABLED === 'true' // the old server setting, until switched here
  },
  chat: { label: 'Chatbot on the website', public: true, help: 'Chicky, the helper in the corner of every page.', default: () => true },
  gallery: { label: 'Photo gallery on the home page', public: true, help: 'Photos marked "Gallery" in the Photos tab.', default: () => true }
};

// { id: true/false } for every feature: the saved switch, or its default.
async function all() {
  const { rows } = await pool.query('SELECT id, enabled FROM features');
  const saved = Object.fromEntries(rows.map((r) => [r.id, r.enabled]));
  return Object.fromEntries(Object.entries(LIST).map(([id, f]) => [id, id in saved ? saved[id] : f.default()]));
}
const on = async (id) => (await all())[id] === true;

// Only what the website needs, for the bootstrap data.
async function publicOnes() {
  const state = await all();
  return Object.fromEntries(Object.keys(LIST).filter((id) => LIST[id].public).map((id) => [id, state[id]]));
}

// For Team → Features.
async function describe() {
  const state = await all();
  return Object.entries(LIST).map(([id, f]) => ({ id, label: f.label, help: f.help, public: f.public, enabled: state[id] }));
}

async function set(id, enabled, fail) {
  if (!Object.hasOwn(LIST, id)) fail('Unknown feature.'); // not "constructor" and the like
  if (typeof enabled !== 'boolean') fail('Say true or false.');
  await pool.query('INSERT INTO features (id, enabled) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET enabled = $2, updated_at = now()', [id, !!enabled]);
  return describe();
}

module.exports = { all, on, publicOnes, describe, set, LIST };
