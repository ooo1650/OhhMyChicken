/* Formatting and small pure helpers shared by the site and the dashboard. */
export const PIZZA_CATEGORIES = ['nonveg', 'fish', 'veg', 'porkbuff'];

export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const money = (settings, n) => settings.currency + ' ' + Number(n || 0).toLocaleString('en-IN');

export function fmt12(t) {
  const p = String(t).split(':'), h = +p[0];
  return ((h % 12) || 12) + ':' + (p[1] || '00') + (h < 12 ? ' AM' : ' PM');
}

// The restaurant's clock: Nepal time (UTC+5:45, no daylight saving), whatever
// time zone the visitor's phone is set to.
const STORE_UTC_OFFSET_MIN = 5 * 60 + 45;
export const storeMinutes = (d) => (d.getUTCHours() * 60 + d.getUTCMinutes() + STORE_UTC_OFFSET_MIN) % 1440;

export function isOpenNow(settings, date) {
  const mins = storeMinutes(date || new Date());
  const toMin = (t) => { const p = String(t).split(':'); return (+p[0]) * 60 + (+p[1] || 0); };
  const o = toMin(settings.hoursOpen), c = toMin(settings.hoursClose);
  return c > o ? (mins >= o && mins < c) : (mins >= o || mins < c); // handles past-midnight close
}

const DIET_LABELS = { veg: 'Veg', chicken: 'Chicken', fish: 'Fish', buff: 'Buff', pork: 'Pork', mix: 'Mixed meat' };
export const dietLabel = (d) => DIET_LABELS[d] || d;

export const reducedMotion = typeof window !== 'undefined' && window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
