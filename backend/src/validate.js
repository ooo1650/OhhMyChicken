/* ==========================================================================
   Input validation for menu items and settings. Mirrors the limits the
   admin forms already enforce, so the API can't be fed anything the UI
   wouldn't produce.
   ========================================================================== */
'use strict';
const { CATEGORIES, PIZZA_CATEGORIES, DIETS, SETTINGS } = require('./defaults');

class ValidationError extends Error {
  constructor(message) { super(message); this.status = 400; }
}
function fail(msg) { throw new ValidationError(msg); }

const CAT_IDS = CATEGORIES.map((c) => c.id);
const ID_RE = /^[\w-]{1,40}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function url(v, field) {
  v = str(v, 300, field);
  if (!v) return '';
  let u;
  try { u = new URL(v); } catch (e) { fail(field + ' must be a full link starting with https://'); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') fail(field + ' must be a web link.');
  return u.href;
}
// Optional coordinate: '' / null → null, otherwise a number within ±max.
function coord(v, max, field) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < -max || n > max) fail(field + ' must be a number between -' + max + ' and ' + max + '.');
  return Math.round(n * 1e6) / 1e6;
}

// Text as stored: Unicode-normalised, without invisible characters that can disguise
// what is shown (control codes, right-to-left overrides, zero-width spaces), and on
// one line with single spaces. Joiners stay: Devanagari and emoji need them.
// multiline keeps line breaks (at most one blank line in a row).
const INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF\uFFF9-\uFFFB]/g;
function clean(v, { multiline = false } = {}) {
  let s = String(v).normalize('NFC').replace(/\r\n?|[\u2028\u2029]/g, '\n').replace(INVISIBLE, '');
  s = multiline
    ? s.split('\n').map((l) => l.replace(/[\t ]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n')
    : s.replace(/\s+/g, ' ');
  return s.trim();
}

function str(v, max, field, { required = false, multiline = false } = {}) {
  if (v == null) v = '';
  if (typeof v !== 'string') fail(field + ' must be text.');
  v = clean(v, { multiline });
  if (required && !v) fail(field + ' is required.');
  if (v.length > max) fail(field + ' must be at most ' + max + ' characters.');
  return v;
}
function int(v, min, max, field) {
  const n = Number(v);
  if (v === '' || v == null || !Number.isFinite(n)) fail(field + ' must be a number.');
  const r = Math.round(n);
  if (r < min || r > max) fail(field + ' must be between ' + min + ' and ' + max + '.');
  return r;
}

function item(raw) {
  if (!raw || typeof raw !== 'object') fail('Invalid menu item.');
  const id = String(raw.id || '');
  if (!ID_RE.test(id)) fail('Invalid item id.');
  const name = str(raw.name, 60, 'Name', { required: true });
  if (!CAT_IDS.includes(raw.category)) fail('Unknown category for “' + name + '”.');
  const diet = DIETS.includes(raw.diet) ? raw.diet : 'veg';
  const desc = str(raw.desc, 140, 'Description', { multiline: true });
  if (!Array.isArray(raw.prices) || !raw.prices.length) fail('“' + name + '” needs at least one price.');
  if (raw.prices.length > 12) fail('“' + name + '” has too many variants.');
  const prices = raw.prices.map((p) => {
    if (!p || typeof p !== 'object') fail('Invalid price for “' + name + '”.');
    const label = str(p.label, 20, 'Variant label', { required: true });
    return { label, price: int(p.price, 0, 10000000, 'Price for “' + label + '”') };
  });
  const labels = prices.map((p) => p.label.toLowerCase());
  if (labels.some((l, i) => labels.indexOf(l) !== i)) fail('Variant labels must be unique.');
  return {
    id, name, category: raw.category, diet, desc, prices,
    available: raw.available !== false,
    popular: !!raw.popular,
    noDelivery: !!raw.noDelivery,
    imageId: imageId(raw.imageId),
    art: art(raw.art)
  };
}

// Key of a built-in drawing (the list lives in the frontend), or '' to pick one from the name.
function art(v) {
  if (v == null || v === '') return '';
  if (typeof v !== 'string' || !/^[a-z0-9-]{1,32}$/.test(v)) fail('Invalid artwork.');
  return v;
}

// A photo from the media library, or null for none (existence is checked against the db).
function imageId(v) {
  if (v == null || v === '') return null;
  if (typeof v !== 'string' || !/^[a-f0-9]{24}$/.test(v)) fail('Invalid photo.');
  return v;
}

function menu(list) {
  if (!Array.isArray(list) || !list.length) fail('Menu must be a non-empty list.');
  if (list.length > 1000) fail('Menu is too large.');
  const ids = new Set();
  return list.map((raw, i) => {
    // Imports may lack ids; give them stable ones.
    const it = item(Object.assign({}, raw, { id: raw && raw.id ? raw.id : 'imp' + i + Date.now().toString(36) }));
    if (ids.has(it.id)) fail('Duplicate item id “' + it.id + '”.');
    ids.add(it.id);
    return it;
  });
}

// Merge a (partial) settings object over the current one, validating every field.
function settings(raw, current) {
  if (!raw || typeof raw !== 'object') fail('Invalid settings.');
  const base = JSON.parse(JSON.stringify(current || SETTINGS));
  const s = Object.assign(base, raw, { promo: Object.assign({}, base.promo, raw.promo || {}) });
  const p = s.promo;
  const whatsapp = String(s.whatsapp == null ? '' : s.whatsapp).replace(/\D/g, '');
  if (whatsapp && !/^\d{8,15}$/.test(whatsapp)) fail('WhatsApp number must be 8–15 digits.');
  if (+s.deliveryFeeMax < +s.deliveryFeeMin) fail('The highest delivery fee can\'t be below the lowest.');
  if (!TIME_RE.test(s.hoursOpen) || !TIME_RE.test(s.hoursClose)) fail('Opening hours must be in HH:MM format.');
  return {
    name: str(s.name, 60, 'Store name', { required: true }),
    phone: str(s.phone, 30, 'Phone'),
    whatsapp,
    address: str(s.address, 160, 'Address'),
    hoursOpen: s.hoursOpen,
    hoursClose: s.hoursClose,
    deliveryFeeMin: int(s.deliveryFeeMin, 0, 1000000, 'Lowest delivery fee'),
    deliveryFeeMax: int(s.deliveryFeeMax, 0, 1000000, 'Highest delivery fee'),
    currency: str(s.currency, 5, 'Currency'),
    street: str(s.street, 120, 'Street address'),
    city: str(s.city, 60, 'City', { required: true }),
    region: str(s.region, 60, 'Region'),
    postalCode: str(s.postalCode, 12, 'Postal code'),
    country: countryCode(s.country),
    currencyCode: currencyCode(s.currencyCode),
    lat: coord(s.lat, 90, 'Latitude'),
    lng: coord(s.lng, 180, 'Longitude'),
    mapsUrl: url(s.mapsUrl, 'Google Maps link'),
    socialLinks: socialLinks(s.socialLinks),
    dineIn: s.dineIn !== false,
    takeaway: !!s.takeaway,
    outlets: outlets(s.outlets),
    promo: {
      enabled: !!p.enabled,
      popup: !!p.popup,
      code: str(p.code, 20, 'Promo code').toUpperCase(),
      percent: int(p.percent, 1, 90, 'Promo %'),
      headline: str(p.headline, 80, 'Headline'),
      delaySec: int(p.delaySec, 0, 60, 'Pop-up delay')
    }
  };
}

// Branches. Each takes its own WhatsApp orders; hours left empty follow the store hours.
function outlets(v) {
  if (v == null) return [];
  if (!Array.isArray(v)) fail('Invalid outlets.');
  if (v.length > 20) fail('Add at most 20 outlets.');
  const ids = new Set();
  let main = false;
  return v.map((o, i) => {
    if (!o || typeof o !== 'object') fail('Invalid outlet.');
    const name = str(o.name, 40, 'Outlet name', { required: true });
    const id = String(o.id || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'outlet-' + (i + 1));
    if (!/^[a-z0-9-]{1,40}$/.test(id)) fail('Invalid outlet id.');
    if (ids.has(id)) fail('Two outlets share the id “' + id + '”.');
    ids.add(id);
    const phones = (Array.isArray(o.phones) ? o.phones : String(o.phones || '').split(/[,/]/))
      .map((p) => String(p || '').trim()).filter(Boolean);
    if (phones.length > 4) fail('Add at most 4 phone numbers for ' + name + '.');
    phones.forEach((p) => { if (!/^[+\d][\d\s-]{5,24}$/.test(p)) fail('“' + p + '” is not a phone number (' + name + ').'); });
    const whatsapp = String(o.whatsapp == null ? '' : o.whatsapp).replace(/\D/g, '');
    if (whatsapp && !/^\d{8,15}$/.test(whatsapp)) fail('WhatsApp number for ' + name + ' must be 8–15 digits with country code.');
    const open = String(o.hoursOpen || ''), close = String(o.hoursClose || '');
    if ((open || close) && !(TIME_RE.test(open) && TIME_RE.test(close))) fail('Hours for ' + name + ' must both be HH:MM, or both empty.');
    const isMain = !!o.main && !main;
    if (isMain) main = true;
    return {
      id, name,
      area: str(o.area, 60, 'Area'),
      address: str(o.address, 160, 'Address'),
      landmark: str(o.landmark, 200, 'Directions', { multiline: true }),
      phones, whatsapp,
      delivery: str(o.delivery, 120, 'Delivery area'),
      hoursOpen: open, hoursClose: close,
      mapsUrl: url(o.mapsUrl, 'Map link'),
      lat: coord(o.lat, 90, 'Latitude for ' + name),
      lng: coord(o.lng, 180, 'Longitude for ' + name),
      instagram: url(o.instagram, 'Instagram link'),
      facebook: url(o.facebook, 'Facebook link'),
      main: isMain,
      active: o.active !== false
    };
  });
}

function countryCode(v) {
  v = String(v || 'NP').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(v)) fail('Country must be a 2-letter code, e.g. NP.');
  return v;
}
function currencyCode(v) {
  v = String(v || 'NPR').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(v)) fail('Currency code must be 3 letters, e.g. NPR.');
  return v;
}
function socialLinks(v) {
  const list = Array.isArray(v) ? v : String(v || '').split(/\s+/);
  const out = list.map((x) => String(x || '').trim()).filter(Boolean);
  if (out.length > 8) fail('Add at most 8 social links.');
  return out.map((x) => url(x, 'Social link'));
}

function isPizza(category) { return PIZZA_CATEGORIES.includes(category); }

module.exports = { ValidationError, item, menu, settings, isPizza, fail, clean };
