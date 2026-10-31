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

const f = (n) => n.toFixed(1);

// A wobbly circle (centred on 200,200), so nothing looks stamped out by a compass.
function wobble(r, amount, rand) {
  const p = [rand() * 6.3, rand() * 6.3, rand() * 6.3], pts = [], n = 48;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    const k = r * (1 + amount * (Math.sin(a * 3 + p[0]) * .5 + Math.sin(a * 7 + p[1]) * .3 + Math.sin(a * 13 + p[2]) * .2));
    pts.push([200 + Math.cos(a) * k, 200 + Math.sin(a) * k]);
  }
  const mid = (u, v) => f((u[0] + v[0]) / 2) + ' ' + f((u[1] + v[1]) / 2);
  let d = 'M' + mid(pts[n - 1], pts[0]);
  pts.forEach((q, i) => { d += 'Q' + f(q[0]) + ' ' + f(q[1]) + ' ' + mid(q, pts[(i + 1) % n]); });
  return d + 'z';
}

// Toppings, drawn around 0,0. `g` is the id prefix of the shared gradients.
const TOPPINGS = {
  pepperoni: (g, rand) => {
    let oil = '';
    for (let i = 0; i < 5; i++) oil += '<circle cx="' + f((rand() - .5) * 26) + '" cy="' + f((rand() - .5) * 26) + '" r="' + f(1.2 + rand() * 1.4) + '" fill="#5E120C" opacity=".55"/>';
    return '<circle cy="2.5" r="23" fill="#5A2A08" opacity=".32"/><circle r="22" fill="url(#' + g + 'pep)"/>' +
      '<circle r="19.5" fill="none" stroke="#6B150E" stroke-width="3" opacity=".5"/>' + oil +
      '<path d="M-13 -9A16 16 0 0 1 2 -15.5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".26"/>';
  },
  mushroom: () => '<path d="M0 3.5C-17 3.5-19-5-15-10-10-16 10-16 15-10 19-5 17 3.5 0 3.5z" transform="translate(0 3)" fill="#5A2A08" opacity=".25"/>' +
    '<path d="M-5 2L-4 13C-4 16 4 16 4 13L5 2z" fill="#EFE3CF" stroke="#B59C7A" stroke-width="1"/>' +
    '<path d="M0 4C-17 4-19-5-15-10-10-16 10-16 15-10 19-5 17 4 0 4z" fill="#F2E7D5" stroke="#B59C7A" stroke-width="1"/>' +
    '<path d="M-13-1Q0-5 13-1M-9-6Q0-9 9-6" fill="none" stroke="#C7AF8C" stroke-width="1.2" stroke-linecap="round"/>',
  olive: () => '<circle cy="1.5" r="10" fill="#5A2A08" opacity=".3"/><circle r="9.5" fill="#23201F"/><circle r="3.6" fill="#E9B85C"/>' +
    '<path d="M-6-4.5A7.5 7.5 0 0 1 1-7" fill="none" stroke="#8C8784" stroke-width="1.6" stroke-linecap="round"/>',
  basil: (g) => '<path d="M0-20C14-12 15 7 0 20-15 7-14-12 0-20z" transform="translate(1 2.5)" fill="#5A2A08" opacity=".22"/>' +
    '<path d="M0-20C14-12 15 7 0 20-15 7-14-12 0-20z" fill="url(#' + g + 'leaf)"/>' +
    '<path d="M0-16V15M0-7L7-12M0-7L-7-12M0 1L8-4M0 1L-8-4M0 8L6 4M0 8L-6 4" fill="none" stroke="#0B5E32" stroke-width="1.1" stroke-linecap="round"/>',
  pepper: () => '<path d="M-15 5C-12-11 12-11 15 5" fill="none" stroke="#0D7440" stroke-width="7.5" stroke-linecap="round"/>' +
    '<path d="M-14 3C-11-10 11-10 14 3" fill="none" stroke="#2BA868" stroke-width="3" stroke-linecap="round"/>',
  sausage: (g, rand) => {
    let fleck = '';
    for (let i = 0; i < 6; i++) fleck += '<circle cx="' + f((rand() - .5) * 20) + '" cy="' + f((rand() - .5) * 18) + '" r="1.5" fill="#4A2412"/>';
    return '<path d="M-14-3C-13-13 9-15 14-5 18 5 9 14-2 13-12 12-15 5-14-3z" transform="translate(0 2.5)" fill="#5A2A08" opacity=".3"/>' +
      '<path d="M-14-3C-13-13 9-15 14-5 18 5 9 14-2 13-12 12-15 5-14-3z" fill="#8A4F2A"/>' + fleck;
  },
  onion: () => '<path d="M-14 4C-10-11 10-11 14 4" fill="none" stroke="#9A4F8F" stroke-width="4" stroke-linecap="round"/>' +
    '<path d="M-9 4C-6-5 6-5 9 4" fill="none" stroke="#E9CFE4" stroke-width="2.4" stroke-linecap="round"/>'
};
const RECIPES = {
  hero: [['pepperoni', 13, 23], ['mushroom', 6, 18], ['olive', 8, 11], ['pepper', 4, 15], ['basil', 4, 18]],
  mix: [['pepperoni', 7, 23], ['sausage', 7, 16], ['mushroom', 4, 18], ['onion', 5, 14], ['olive', 5, 11], ['pepper', 3, 15], ['basil', 2, 18]]
};

/**
 * Pizza SVG: baked crust, melted cheese and shaded toppings, seen from above.
 * @param {object} o  { diet: 'hero' | 'mix', seed, slices, id }
 */
function pizza(o) {
  o = o || {};
  // Unique per render: duplicate gradient ids break when the first copy sits in a hidden view.
  const g = (o.id || 'p') + '_' + (++uidCounter);
  const rand = rng(o.seed || 7);
  const recipe = RECIPES[o.diet] || RECIPES.hero;

  // Blistered, browned spots on the crust.
  let baked = '';
  for (let i = 0; i < 46; i++) {
    const a = rand() * Math.PI * 2, r = 171 + rand() * 18;
    const big = rand() > .72;
    baked += '<ellipse cx="' + f(200 + Math.cos(a) * r) + '" cy="' + f(200 + Math.sin(a) * r) + '" rx="' + f(big ? 7 + rand() * 6 : 2 + rand() * 3) + '" ry="' + f(big ? 4 + rand() * 3 : 2 + rand() * 2) +
      '" transform="rotate(' + f(a * 57.3 + 90) + ' ' + f(200 + Math.cos(a) * r) + ' ' + f(200 + Math.sin(a) * r) + ')" fill="url(#' + g + 'char)" opacity="' + f(.35 + rand() * .45) + '"/>';
  }
  // Browned and creamy patches in the cheese.
  let cheese = '';
  for (let i = 0; i < 22; i++) {
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 148;
    const brown = i % 3 === 0;
    cheese += '<circle cx="' + f(200 + Math.cos(a) * r) + '" cy="' + f(200 + Math.sin(a) * r) + '" r="' + f(brown ? 8 + rand() * 12 : 16 + rand() * 24) + '" fill="url(#' + g + (brown ? 'toast' : 'melt') + ')"/>';
  }

  // Scatter the toppings, keeping each as far from the others as we can.
  const placed = [];
  let toppings = '';
  recipe.forEach(([kind, count, size]) => {
    for (let i = 0; i < count; i++) {
      let best = null, gap = -Infinity;
      for (let t = 0; t < 40; t++) {
        const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * (150 - size * .6);
        const x = 200 + Math.cos(a) * r, y = 200 + Math.sin(a) * r;
        const room = placed.reduce((m, q) => Math.min(m, Math.hypot(q.x - x, q.y - y) - q.size - size), 999);
        if (room > gap) { gap = room; best = { x, y, size }; }
      }
      placed.push(best);
      toppings += '<g transform="translate(' + f(best.x) + ' ' + f(best.y) + ') rotate(' + Math.round(rand() * 360) + ')">' + TOPPINGS[kind](g, rand) + '</g>';
    }
  });

  // Herbs on top.
  let herbs = '';
  for (let i = 0; i < 70; i++) {
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 155;
    herbs += '<circle cx="' + f(200 + Math.cos(a) * r) + '" cy="' + f(200 + Math.sin(a) * r) + '" r="' + f(.8 + rand() * .9) + '" fill="#2E5A24" opacity=".75"/>';
  }

  // Slice cuts: a dark line with a light edge.
  const slices = o.slices || 8;
  let cuts = '', lights = '';
  for (let s = 0; s < slices; s++) {
    const ang = (s / slices) * Math.PI * 2 + .2, x = f(200 + Math.cos(ang) * 186), y = f(200 + Math.sin(ang) * 186);
    cuts += '<line x1="200" y1="200" x2="' + x + '" y2="' + y + '"/>';
    lights += '<line x1="201" y1="201" x2="' + f(201 + Math.cos(ang) * 186) + '" y2="' + f(201 + Math.sin(ang) * 186) + '"/>';
  }

  const stops = (list) => list.map(([at, c, op]) => '<stop offset="' + at + '" stop-color="' + c + '"' + (op == null ? '' : ' stop-opacity="' + op + '"') + '/>').join('');
  return '<svg viewBox="0 0 400 400" class="pizza-svg" aria-hidden="true" focusable="false">' +
    '<defs>' +
      '<radialGradient id="' + g + 'crust" cx="50%" cy="50%" r="50%">' + stops([['.8', '#B8742C'], ['.87', '#E0A04A'], ['.93', '#F0BD6C'], ['.975', '#C98434'], ['1', '#8A5219']]) + '</radialGradient>' +
      '<radialGradient id="' + g + 'cheese" cx="44%" cy="40%" r="62%">' + stops([['0', '#FFE08A'], ['.65', '#FBC858'], ['1', '#E9A233']]) + '</radialGradient>' +
      '<radialGradient id="' + g + 'melt">' + stops([['0', '#FFEFB5', '.75'], ['1', '#FFEFB5', '0']]) + '</radialGradient>' +
      '<radialGradient id="' + g + 'toast">' + stops([['0', '#B9681C', '.5'], ['1', '#B9681C', '0']]) + '</radialGradient>' +
      '<radialGradient id="' + g + 'char">' + stops([['0', '#5A2E0E', '1'], ['1', '#7A4516', '0']]) + '</radialGradient>' +
      '<radialGradient id="' + g + 'pep" cx="40%" cy="38%" r="68%">' + stops([['0', '#D8432F'], ['.7', '#B42A1C'], ['1', '#7E170E']]) + '</radialGradient>' +
      '<linearGradient id="' + g + 'leaf" x1="0" y1="0" x2="1" y2="1">' + stops([['0', '#2BA868'], ['1', '#0D7440']]) + '</linearGradient>' +
      '<radialGradient id="' + g + 'light" cx="36%" cy="30%" r="78%">' + stops([['0', '#fff', '.16'], ['.5', '#fff', '0'], ['1', '#3A1604', '.3']]) + '</radialGradient>' +
    '</defs>' +
    '<path d="' + wobble(194, .012, rand) + '" fill="url(#' + g + 'crust)"/>' + baked +
    '<path d="' + wobble(166, .014, rand) + '" fill="#B5301B"/>' +
    '<path d="' + wobble(160, .022, rand) + '" fill="url(#' + g + 'cheese)"/>' + cheese +
    '<g stroke="#8A5219" stroke-width="2.4" opacity=".4">' + cuts + '</g>' +
    '<g stroke="#FFF3CF" stroke-width="1" opacity=".35">' + lights + '</g>' +
    toppings + herbs +
    '<circle cx="200" cy="200" r="194" fill="url(#' + g + 'light)"/>' +
  '</svg>';
}

// Menu card drawing for an item: see shared/food-art.js.
const iconFor = artSvg;

export { pizza, iconFor };

// An SVG string from this file, inside a wrapper element.
export function Art({ html, as: Tag = 'div', ...rest }) {
  return <Tag {...rest} dangerouslySetInnerHTML={{ __html: html }} />;
}
