/* Branches (outlets): the list the site shows, their hours and contact links.
   Used by the site, the dashboard and the SEO renderer, so no React here. */
import { isOpenNow } from './format.js';

/** Outlets customers can see and order from, in the dashboard's order. With none
 *  set up, the store's own contact details stand in as a single outlet. */
export function outletList(s) {
  const list = (s.outlets || []).filter((o) => o.active !== false);
  if (list.length) return list;
  return [{
    id: '', name: s.name, area: s.city || '', address: s.address || '', landmark: '', main: true,
    phones: s.phone ? [s.phone] : [], whatsapp: s.whatsapp || '', delivery: '', mapsUrl: s.mapsUrl || '',
    instagram: '', facebook: '', hoursOpen: '', hoursClose: '', single: true
  }];
}

/** The area the Find us map covers (degrees), and whether an outlet's pin fits on it
 *  (a little past the edge is held at the edge; farther away stays list-only). */
export const VALLEY = { n: 27.79, s: 27.62, w: 85.24, e: 85.47 };
const NEAR = 0.04;
export const onMap = (o) => o.lat != null && o.lng != null &&
  o.lat < VALLEY.n + NEAR && o.lat > VALLEY.s - NEAR && o.lng > VALLEY.w - NEAR && o.lng < VALLEY.e + NEAR;

/** Opening hours of an outlet: its own, or the store's. */
export const outletHours = (o, s) => (o.hoursOpen && o.hoursClose ? { hoursOpen: o.hoursOpen, hoursClose: o.hoursClose } : { hoursOpen: s.hoursOpen, hoursClose: s.hoursClose });
export const outletOpen = (o, s, now) => isOpenNow(outletHours(o, s), now);

/** WhatsApp number (digits with country code) orders to this outlet go to. */
export const outletWhatsApp = (o, s) => String(o.whatsapp || s.whatsapp || '').replace(/\D/g, '');
export const telHref = (phone) => 'tel:' + String(phone).replace(/[^\d+]/g, '');
export function mapHref(o, s) {
  return o.mapsUrl || 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([s.name, o.address || o.name, o.area].filter(Boolean).join(' '));
}
/** "Jhamsikhel, Lalitpur" — the name plus the area, without saying a place twice. */
export function outletTitle(o) {
  const n = o.name.toLowerCase(), a = (o.area || '').toLowerCase();
  if (!a || n.includes(a)) return o.name;
  return a.includes(n) ? o.area : o.name + ', ' + o.area;
}
