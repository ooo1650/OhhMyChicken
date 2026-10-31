/* ==========================================================================
   Art — hand-built SVG illustrations (size-guide pizza, menu art).
   Pure strings, so they are crisp at any size and cost zero image requests.
   Rendered with <Art html={...}/>; the strings never contain user input.
   ========================================================================== */
import { artSvg } from '../shared/food-art.js';

let uidCounter = 0;

// Deterministic PRNG so the same pizza always looks the same.
function rng(seed) {
  let s = seed >>> 0 || 1;
  return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

let TOPPING_SETS = {
  pork:    [{ t: 'pep', c: '#B3121B' }, { t: 'pep', c: '#C8202A' }],
  chicken: [{ t: 'chunk', c: '#C27A3A' }, { t: 'pep', c: '#C8202A' }, { t: 'leaf', c: '#2E8B3D' }],
  buff:    [{ t: 'pep', c: '#7A1C1C' }, { t: 'chunk', c: '#5B2B1A' }],
  fish:    [{ t: 'chunk', c: '#E9C9A5' }, { t: 'olive', c: '#1C1C1C' }, { t: 'corn', c: '#FFD84D' }],
  veg:     [{ t: 'pepper', c: '#2E8B3D' }, { t: 'olive', c: '#1C1C1C' }, { t: 'mush', c: '#E8D9C4' }, { t: 'corn', c: '#FFD84D' }],
  mix:     [{ t: 'pep', c: '#B3121B' }, { t: 'chunk', c: '#C27A3A' }, { t: 'olive', c: '#1C1C1C' }, { t: 'leaf', c: '#2E8B3D' }],
  hero:    [{ t: 'pep', c: '#C8202A' }, { t: 'pep', c: '#B3121B' }, { t: 'olive', c: '#1C1C1C' }, { t: 'leaf', c: '#2E8B3D' }, { t: 'mush', c: '#EADCC8' }]
};

function topping(t, x, y, r, c, rot) {
  switch (t) {
    case 'pep':
      return '<g transform="translate(' + x + ' ' + y + ')"><circle r="' + r + '" fill="' + c + '"/>' +
             '<circle r="' + (r * 0.78) + '" fill="none" stroke="#00000022" stroke-width="2"/>' +
             '<circle cx="' + (-r * .3) + '" cy="' + (-r * .25) + '" r="' + (r * .14) + '" fill="#ffffff33"/>' +
             '<circle cx="' + (r * .3) + '" cy="' + (r * .2) + '" r="' + (r * .1) + '" fill="#00000022"/></g>';
    case 'olive':
      return '<g transform="translate(' + x + ' ' + y + ')"><circle r="' + (r * .55) + '" fill="none" stroke="' + c + '" stroke-width="' + (r * .32) + '"/></g>';
    case 'leaf':
      return '<path transform="translate(' + x + ' ' + y + ') rotate(' + rot + ')" d="M0 ' + (-r) + ' C ' + (r * .8) + ' ' + (-r * .4) + ' ' + (r * .6) + ' ' + (r * .6) + ' 0 ' + r + ' C ' + (-r * .6) + ' ' + (r * .6) + ' ' + (-r * .8) + ' ' + (-r * .4) + ' 0 ' + (-r) + 'z" fill="' + c + '"/>';
    case 'chunk':
      return '<rect transform="translate(' + x + ' ' + y + ') rotate(' + rot + ')" x="' + (-r * .7) + '" y="' + (-r * .5) + '" width="' + (r * 1.4) + '" height="' + r + '" rx="' + (r * .3) + '" fill="' + c + '"/>';
    case 'pepper':
      return '<path transform="translate(' + x + ' ' + y + ') rotate(' + rot + ')" d="M' + (-r) + ' 0 A ' + r + ' ' + r + ' 0 0 1 ' + r + ' 0" fill="none" stroke="' + c + '" stroke-width="' + (r * .35) + '" stroke-linecap="round"/>';
    case 'mush':
      return '<g transform="translate(' + x + ' ' + y + ') rotate(' + rot + ')"><path d="M' + (-r) + ' 0 A ' + r + ' ' + (r * .8) + ' 0 0 1 ' + r + ' 0z" fill="' + c + '"/><rect x="' + (-r * .3) + '" y="0" width="' + (r * .6) + '" height="' + (r * .7) + '" rx="2" fill="' + c + '"/></g>';
    case 'corn':
      return '<circle cx="' + x + '" cy="' + y + '" r="' + (r * .35) + '" fill="' + c + '"/>';
  }
  return '';
}

/**
 * Pizza SVG.
 * @param {object} o  { diet, seed, slices, id }
 */
function pizza(o) {
  o = o || {};
  // Unique per render: duplicate gradient ids break when the first copy sits in a hidden view.
  let id = (o.id || 'p') + '_' + (++uidCounter);
  let set = TOPPING_SETS[o.diet] || TOPPING_SETS.hero;
  let rand = rng(o.seed || 7);
  let cx = 200, cy = 200, parts = [];

  // Cheese blobs
  let blobs = '';
  for (let b = 0; b < 14; b++) {
    let ba = rand() * Math.PI * 2, br = rand() * 120;
    blobs += '<circle cx="' + (cx + Math.cos(ba) * br).toFixed(1) + '" cy="' + (cy + Math.sin(ba) * br).toFixed(1) + '" r="' + (18 + rand() * 22).toFixed(1) + '" fill="#FFE07A" opacity=".55"/>';
  }

  // Toppings arranged on rings with jitter
  let rings = [[0, 1], [52, 6], [100, 10], [138, 14]];
  rings.forEach(function (ring) {
    for (let i = 0; i < ring[1]; i++) {
      let a = (i / ring[1]) * Math.PI * 2 + rand() * .5;
      let rr = ring[0] + (rand() - .5) * 14;
      let tp = set[Math.floor(rand() * set.length)];
      let size = tp.t === 'pep' ? 17 + rand() * 4 : 10 + rand() * 5;
      parts.push(topping(tp.t, (cx + Math.cos(a) * rr).toFixed(1), (cy + Math.sin(a) * rr).toFixed(1), size.toFixed(1), tp.c, Math.round(rand() * 360)));
    }
  });

  // Slice cuts
  let slices = o.slices || 8, cuts = '';
  for (let s = 0; s < slices; s++) {
    let ang = (s / slices) * Math.PI * 2;
    cuts += '<line x1="200" y1="200" x2="' + (200 + Math.cos(ang) * 172).toFixed(1) + '" y2="' + (200 + Math.sin(ang) * 172).toFixed(1) + '"/>';
  }

  return '<svg viewBox="0 0 400 400" class="pizza-svg" aria-hidden="true" focusable="false">' +
    '<defs>' +
      '<radialGradient id="' + id + 'c" cx="50%" cy="45%" r="55%"><stop offset="80%" stop-color="#F2B35B"/><stop offset="93%" stop-color="#D98B32"/><stop offset="100%" stop-color="#A85F1E"/></radialGradient>' +
      '<radialGradient id="' + id + 'h" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#FFD25C"/><stop offset="100%" stop-color="#FDB833"/></radialGradient>' +
    '</defs>' +
    '<circle cx="200" cy="206" r="194" fill="#00000030"/>' +
    '<circle cx="200" cy="200" r="194" fill="url(#' + id + 'c)"/>' +
    '<circle cx="200" cy="200" r="170" fill="#D7261E"/>' +
    '<path d="M200 38 C 290 32 372 110 362 205 C 358 300 288 366 196 362 C 110 360 34 290 40 196 C 44 108 118 42 200 38z" fill="url(#' + id + 'h)"/>' +
    blobs + parts.join('') +
    '<g stroke="#A85F1E" stroke-opacity=".35" stroke-width="3">' + cuts + '</g>' +
    '<circle cx="200" cy="200" r="190" fill="none" stroke="#ffffff22" stroke-width="4" stroke-dasharray="4 18"/>' +
  '</svg>';
}

// Menu card drawing for an item: see shared/food-art.js.
const iconFor = artSvg;

export { pizza, iconFor };

// An SVG string from this file, inside a wrapper element.
export function Art({ html, as: Tag = 'div', ...rest }) {
  return <Tag {...rest} dangerouslySetInnerHTML={{ __html: html }} />;
}
