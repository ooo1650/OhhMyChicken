/* Writes prerender-data.json: the menu and settings the static HTML is built from.
   The frontend's build can't reach the backend's files (Docker builds it on its own),
   so this copy is committed. Run after changing backend/src/defaults.js; a test checks it.
     node scripts/sync-prerender-data.cjs */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const d = require('../../backend/src/defaults.js');

const data = {
  defaults: { SIZES: d.SIZES, CATEGORIES: d.CATEGORIES, ORDER_DETAILS_DAYS: 90 },
  menu: d.MENU.map((m) => ({ ...m, imageId: null, image: null, isPizza: d.PIZZA_CATEGORIES.includes(m.category) })),
  settings: d.SETTINGS,
  gallery: [],
  updatedAt: null
};
const text = JSON.stringify(data, null, 1) + '\n';
if (require.main === module) fs.writeFileSync(path.join(__dirname, 'prerender-data.json'), text);
module.exports = { text };
