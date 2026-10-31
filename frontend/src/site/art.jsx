/* ==========================================================================
   Art — hand-built SVG illustrations (hero and size-guide pizza, menu art).
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
  // Cupped in the oven: crisp dark rim, a pool of oil in the middle.
  pepperoni: (g, rand) => {
    let char = '';
    for (let i = 0; i < 9; i++) {
      const a = rand() * 6.3, r = 15 + rand() * 6;
      char += '<circle cx="' + f(Math.cos(a) * r) + '" cy="' + f(Math.sin(a) * r) + '" r="' + f(1 + rand() * 1.8) + '" fill="#3A0D07" opacity=".6"/>';
    }
    let fat = '';
    for (let i = 0; i < 7; i++) fat += '<circle cx="' + f((rand() - .5) * 24) + '" cy="' + f((rand() - .5) * 24) + '" r="' + f(.9 + rand() * 1.3) + '" fill="#F08A5C" opacity=".55"/>';
    return '<circle r="23" fill="url(#' + g + 'pep)"/>' + char + fat +
      '<circle r="14" cx="1" cy="1" fill="url(#' + g + 'oil)"/>' +
      '<path d="M-15-11A19 19 0 0 1 4-18" fill="none" stroke="#FFD9C4" stroke-width="2.2" stroke-linecap="round" opacity=".42"/>';
  },
  mushroom: () => '<path d="M-5 2L-4.5 14C-4 17 4 17 4.5 14L5 2z" fill="#E2D2B6"/>' +
    '<path d="M0 5C-17 5-20-5-15-11-10-17 10-17 15-11 20-5 17 5 0 5z" fill="url(#MUSH)"/>' +
    '<path d="M-14 0Q0-3 14 0" fill="none" stroke="#8A6C48" stroke-width="1.4" stroke-linecap="round" opacity=".7"/>' +
    '<path d="M-10-10Q-2-14 7-12" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".55"/>',
  olive: () => '<circle r="10" fill="#1C1917"/><circle r="4" fill="#4A2A1A"/><circle r="2.6" fill="#0E0B0A"/>' +
    '<path d="M-6.5-4.5A8 8 0 0 1 1-7.6" fill="none" stroke="#B9B2AB" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>',
  basil: (g) => '<path d="M0-22C16-13 17 8 0 22-17 8-16-13 0-22z" fill="url(#' + g + 'leaf)"/>' +
    '<path d="M0-18V17M0-9L8-14M0-9L-8-14M0-1L10-6M0-1L-10-6M0 7L7 2M0 7L-7 2" fill="none" stroke="#0A4D2A" stroke-width="1.1" stroke-linecap="round" opacity=".85"/>' +
    '<path d="M-7-10C-9-4-8 2-5 7" fill="none" stroke="#9BE3B8" stroke-width="1.5" stroke-linecap="round" opacity=".5"/>',
  pepper: () => '<path d="M-16 6C-13-12 13-12 16 6" fill="none" stroke="#0B5E34" stroke-width="8" stroke-linecap="round"/>' +
    '<path d="M-14 4C-11-9 11-9 14 4" fill="none" stroke="#2BA868" stroke-width="3.2" stroke-linecap="round"/>',
  sausage: (g, rand) => {
    let fleck = '';
    for (let i = 0; i < 9; i++) fleck += '<circle cx="' + f((rand() - .5) * 22) + '" cy="' + f((rand() - .5) * 20) + '" r="' + f(1 + rand() * 1.1) + '" fill="#3E1D0D"/>';
    return '<path d="M-15-3C-14-14 9-16 15-5 19 5 9 15-2 14-13 13-16 5-15-3z" fill="#8E5229"/>' + fleck +
      '<path d="M-9-8Q0-12 8-8" fill="none" stroke="#D8A077" stroke-width="1.6" stroke-linecap="round" opacity=".6"/>';
  },
  onion: () => '<path d="M-15 5C-11-12 11-12 15 5" fill="none" stroke="#8C3F82" stroke-width="4" stroke-linecap="round"/>' +
    '<path d="M-10 5C-7-5 7-5 10 5" fill="none" stroke="#EBD3E6" stroke-width="2.4" stroke-linecap="round"/>'
};
const RECIPES = {
  hero: [['pepperoni', 13, 23], ['mushroom', 6, 18], ['olive', 8, 11], ['pepper', 4, 15], ['basil', 4, 18]],
  mix: [['pepperoni', 7, 23], ['sausage', 7, 16], ['mushroom', 4, 18], ['onion', 5, 14], ['olive', 5, 11], ['pepper', 3, 15], ['basil', 2, 18]]
};

// Noise used as a height map and lit from the top left, multiplied onto whatever is drawn.
const litSurface = (id, freq, octaves, height, seed) =>
  '<filter id="' + id + '" filterUnits="userSpaceOnUse" x="0" y="0" width="400" height="400" color-interpolation-filters="sRGB">' +
    '<feTurbulence type="fractalNoise" baseFrequency="' + freq + '" numOctaves="' + octaves + '" seed="' + seed + '"/>' +
    '<feDiffuseLighting surfaceScale="' + height + '" diffuseConstant="1.16" lighting-color="#fff" result="l"><feDistantLight azimuth="235" elevation="60"/></feDiffuseLighting>' +
    '<feComposite in="l" in2="SourceGraphic" operator="arithmetic" k1="1" k2="0" k3="0" k4="0"/>' +
    '<feComposite in2="SourceAlpha" operator="in"/>' +
  '</filter>';
// Roughens shapes so edges look melted rather than cut with a compass.
const rough = (id, freq, amount, blur, seed) =>
  '<filter id="' + id + '" filterUnits="userSpaceOnUse" x="0" y="0" width="400" height="400">' +
    '<feTurbulence type="fractalNoise" baseFrequency="' + freq + '" numOctaves="2" seed="' + seed + '"/>' +
    '<feDisplacementMap in="SourceGraphic" scale="' + amount + '" xChannelSelector="R" yChannelSelector="G"/>' +
    (blur ? '<feGaussianBlur stdDeviation="' + blur + '"/>' : '') +
  '</filter>';

/**
 * Pizza SVG, seen from above: a bumpy charred crust, blistered melted cheese
 * with a greasy sheen, and toppings that sit down into the cheese.
 * @param {object} o  { diet: 'hero' | 'mix', seed, slices, id }
 */
function pizza(o) {
  o = o || {};
  // Unique per render: duplicate gradient ids break when the first copy sits in a hidden view.
  const g = (o.id || 'p') + '_' + (++uidCounter);
  const rand = rng(o.seed || 7);
  const recipe = RECIPES[o.diet] || RECIPES.hero;
  const around = (r) => { const a = rand() * Math.PI * 2; return [200 + Math.cos(a) * r, 200 + Math.sin(a) * r, a]; };

  // Charred blisters on the crust.
  let baked = '';
  for (let i = 0; i < 64; i++) {
    const [x, y, a] = around(170 + rand() * 22), big = rand() > .68;
    baked += '<ellipse cx="' + f(x) + '" cy="' + f(y) + '" rx="' + f(big ? 7 + rand() * 8 : 2 + rand() * 3) + '" ry="' + f(big ? 3.5 + rand() * 3.5 : 1.5 + rand() * 2) +
      '" transform="rotate(' + f(a * 57.3 + 90) + ' ' + f(x) + ' ' + f(y) + ')" fill="' + (big ? '#7A4114' : '#3F1F09') + '" opacity="' + f(.3 + rand() * .4) + '"/>';
  }
  // The cheese: creamy pools, then golden-brown blisters with darker hearts.
  let melt = '', blisters = '';
  for (let i = 0; i < 20; i++) {
    const [x, y] = around(Math.sqrt(rand()) * 146);
    melt += '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(14 + rand() * 26) + '" fill="url(#' + g + 'melt)"/>';
  }
  for (let i = 0; i < 74; i++) {
    const [x, y] = around(Math.sqrt(rand()) * 156), r = 2.5 + rand() * rand() * 16;
    blisters += '<ellipse cx="' + f(x) + '" cy="' + f(y) + '" rx="' + f(r) + '" ry="' + f(r * (.65 + rand() * .35)) + '" fill="#B5601A" opacity="' + f(.45 + rand() * .4) + '"/>';
    if (r > 6) blisters += '<ellipse cx="' + f(x) + '" cy="' + f(y) + '" rx="' + f(r * .45) + '" ry="' + f(r * .35) + '" fill="#6E3510" opacity=".7"/>';
  }

  // Scatter the toppings, keeping each as far from the others as we can.
  const placed = [];
  let toppings = '', halos = '';
  recipe.forEach(([kind, count, size]) => {
    for (let i = 0; i < count; i++) {
      let best = null, gap = -Infinity;
      for (let t = 0; t < 40; t++) {
        const [x, y] = around(Math.sqrt(rand()) * (148 - size * .6));
        const room = placed.reduce((m, q) => Math.min(m, Math.hypot(q.x - x, q.y - y) - q.size - size), 999);
        if (room > gap) { gap = room; best = { x, y, size }; }
      }
      placed.push(best);
      // Cheese creeping up around each topping.
      halos += '<circle cx="' + f(best.x) + '" cy="' + f(best.y) + '" r="' + f(best.size + 7) + '" fill="#FFE08A" opacity=".6"/>';
      toppings += '<g transform="translate(' + f(best.x) + ' ' + f(best.y) + ') rotate(' + Math.round(rand() * 360) + ')">' + TOPPINGS[kind](g, rand).replace('url(#MUSH)', 'url(#' + g + 'mush)') + '</g>';
    }
  });

  // Dried oregano on top.
  let herbs = '';
  for (let i = 0; i < 90; i++) {
    const [x, y] = around(Math.sqrt(rand()) * 155);
    herbs += '<rect x="' + f(x) + '" y="' + f(y) + '" width="' + f(1 + rand() * 2.2) + '" height="' + f(.8 + rand() * .8) + '" transform="rotate(' + Math.round(rand() * 180) + ' ' + f(x) + ' ' + f(y) + ')" fill="#2E4F20" opacity=".8"/>';
  }

  // Slice cuts: a dark groove with a lit edge beside it.
  const slices = o.slices || 8;
  let cuts = '', lights = '';
  for (let s = 0; s < slices; s++) {
    const ang = (s / slices) * Math.PI * 2 + .2, c = Math.cos(ang), n = Math.sin(ang);
    cuts += '<line x1="200" y1="200" x2="' + f(200 + c * 168) + '" y2="' + f(200 + n * 168) + '"/>';
    lights += '<line x1="201.4" y1="201.4" x2="' + f(201.4 + c * 164) + '" y2="' + f(201.4 + n * 164) + '"/>';
  }

  const stops = (list) => list.map(([at, c, op]) => '<stop offset="' + at + '" stop-color="' + c + '"' + (op == null ? '' : ' stop-opacity="' + op + '"') + '/>').join('');
  return '<svg viewBox="0 0 400 400" class="pizza-svg" aria-hidden="true" focusable="false">' +
    '<defs>' +
      '<radialGradient id="' + g + 'crust" cx="50%" cy="50%" r="50%">' + stops([['.8', '#9C5A1C'], ['.87', '#D18A36'], ['.925', '#F0BC6A'], ['.965', '#D08A34'], ['1', '#74400F']]) + '</radialGradient>' +
      '<radialGradient id="' + g + 'cheese" cx="42%" cy="38%" r="66%">' + stops([['0', '#FFCF55'], ['.6', '#F6AE30'], ['1', '#D9851E']]) + '</radialGradient>' +
      '<radialGradient id="' + g + 'melt">' + stops([['0', '#FFE58F', '.7'], ['1', '#FFE58F', '0']]) + '</radialGradient>' +
      '<radialGradient id="' + g + 'pep" cx="42%" cy="40%" r="62%">' + stops([['0', '#D5412B'], ['.68', '#B92C1B'], ['.88', '#8C1C10'], ['1', '#561008']]) + '</radialGradient>' +
      '<radialGradient id="' + g + 'oil">' + stops([['0', '#E9583A', '.75'], ['1', '#E9583A', '0']]) + '</radialGradient>' +
      '<linearGradient id="' + g + 'mush" x1="0" y1="0" x2="0" y2="1">' + stops([['0', '#F6EBD8'], ['1', '#C7AB84']]) + '</linearGradient>' +
      '<linearGradient id="' + g + 'leaf" x1="0" y1="0" x2="1" y2="1">' + stops([['0', '#2EAE6C'], ['1', '#0B6A39']]) + '</linearGradient>' +
      '<radialGradient id="' + g + 'light" cx="34%" cy="28%" r="82%">' + stops([['0', '#FFF6DC', '.2'], ['.5', '#fff', '0'], ['1', '#2A0F02', '.38']]) + '</radialGradient>' +
      '<clipPath id="' + g + 'onCheese"><circle cx="200" cy="200" r="164"/></clipPath>' +
      litSurface(g + 'crustTex', '.07', 3, 2.2, 11) +
      litSurface(g + 'cheeseTex', '.045', 3, 1.8, 4) +
      rough(g + 'melted', '.035', 11, 0, 8) +
      rough(g + 'spots', '.09', 9, .7, 5) +
      rough(g + 'soft', '.03', 8, 5, 3) +
      rough(g + 'char', '.06', 7, 1.6, 6) +
      '<filter id="' + g + 'sit" filterUnits="userSpaceOnUse" x="0" y="0" width="400" height="400">' +
        '<feTurbulence type="fractalNoise" baseFrequency=".07" numOctaves="2" seed="2"/>' +
        '<feDisplacementMap in="SourceGraphic" scale="4" xChannelSelector="R" yChannelSelector="G"/>' +
        '<feDropShadow dx="1.4" dy="2.4" stdDeviation="1.8" flood-color="#4A2206" flood-opacity=".6"/>' +
      '</filter>' +
      '<filter id="' + g + 'gloss" filterUnits="userSpaceOnUse" x="0" y="0" width="400" height="400" color-interpolation-filters="sRGB">' +
        '<feTurbulence type="fractalNoise" baseFrequency=".04" numOctaves="3" seed="9"/>' +
        '<feSpecularLighting surfaceScale="5" specularConstant=".5" specularExponent="30" lighting-color="#FFF6D8"><feDistantLight azimuth="235" elevation="52"/></feSpecularLighting>' +
        '<feComposite in2="SourceAlpha" operator="in"/>' +
      '</filter>' +
    '</defs>' +
    '<g filter="url(#' + g + 'crustTex)"><path d="' + wobble(195, .016, rand) + '" fill="url(#' + g + 'crust)"/></g>' +
    '<g filter="url(#' + g + 'char)">' + baked + '</g>' +
    // The rim stands over the sauce, so it throws a soft shadow inwards.
    '<circle cx="200" cy="202" r="172" fill="#5A2206" opacity=".7" filter="url(#' + g + 'soft)"/>' +
    '<g filter="url(#' + g + 'melted)"><path d="' + wobble(170, .012, rand) + '" fill="#8E2412"/></g>' +
    '<g filter="url(#' + g + 'melted)"><g filter="url(#' + g + 'cheeseTex)"><path d="' + wobble(167, .018, rand) + '" fill="url(#' + g + 'cheese)"/></g></g>' +
    '<g clip-path="url(#' + g + 'onCheese)">' + melt + '<g filter="url(#' + g + 'spots)">' + blisters + '</g></g>' +
    '<g stroke="#5E2F0B" stroke-width="2.2" stroke-linecap="round" opacity=".6">' + cuts + '</g>' +
    '<g stroke="#FFF1C4" stroke-width="1.1" opacity=".4">' + lights + '</g>' +
    '<g filter="url(#' + g + 'soft)">' + halos + '</g>' +
    '<circle cx="200" cy="200" r="163" filter="url(#' + g + 'gloss)" opacity=".5"/>' +
    '<g filter="url(#' + g + 'sit)">' + toppings + '</g>' + herbs +
    '<circle cx="200" cy="200" r="195" fill="url(#' + g + 'light)"/>' +
  '</svg>';
}

// Menu card drawing for an item: see shared/food-art.js.
const iconFor = artSvg;

export { pizza, iconFor };

// An SVG string from this file, inside a wrapper element.
export function Art({ html, as: Tag = 'div', ...rest }) {
  return <Tag {...rest} dangerouslySetInnerHTML={{ __html: html }} />;
}
