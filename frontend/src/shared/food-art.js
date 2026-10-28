/* ==========================================================================
   Food art — a catalogue of hand-built SVG drawings, one per kind of dish,
   so every card on the menu shows what it is: which pizza (by its toppings),
   wings vs. a bucket, which MoMo, which coffee or tea.

   An item's `art` field names a catalogue key; when it is empty (or unknown)
   the drawing is guessed from the name, so new dishes get a sensible picture
   without any setup. Pure strings: no image requests, crisp at any size.
   The strings never contain user input.
   ========================================================================== */

const INK = '#121212';

// Deterministic PRNG so the same dish always looks the same.
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function hashStr(str) { let h = 7; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return Math.abs(h) + 1; }
const f = (n) => +n.toFixed(1);
const svg = (body, box) => '<svg viewBox="0 0 ' + (box || 100) + ' ' + (box || 100) + '" aria-hidden="true" focusable="false">' + body + '</svg>';

/* ---------- Pizza ---------- */

// Meat colour by the dish's diet, so Chicken BBQ and Pork BBQ differ at a glance.
const MEAT = { chicken: '#E2A86B', pork: '#E58C86', buff: '#6E2E22', fish: '#EFCDB0', mix: '#B5603F', veg: '#E2A86B' };
const darker = (hex, k) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('');

// Each topping is drawn centred on 0,0 with radius s (pizza space is 400×400).
const TOP = {
  pep: (s) => '<circle r="' + s + '" fill="#C8202A"/><circle r="' + f(s * .74) + '" fill="none" stroke="#00000022" stroke-width="3"/><circle cx="' + f(-s * .3) + '" cy="' + f(-s * .3) + '" r="' + f(s * .16) + '" fill="#ffffff40"/>',
  salami: (s) => '<circle r="' + s + '" fill="#9E1530" stroke="#6E0C1F" stroke-width="3"/>' +
    [[-.4, -.3], [.3, -.45], [.45, .2], [-.15, .4], [-.5, .25], [.05, -.05]].map(([x, y]) => '<ellipse cx="' + f(x * s) + '" cy="' + f(y * s) + '" rx="' + f(s * .13) + '" ry="' + f(s * .09) + '" fill="#F7D9D4"/>').join(''),
  sausage: (s, m) => '<circle r="' + s + '" fill="' + m + '" stroke="' + darker(m, .7) + '" stroke-width="4"/>' +
    [[-.35, -.2], [.3, -.35], [.2, .35], [-.3, .35]].map(([x, y]) => '<circle cx="' + f(x * s) + '" cy="' + f(y * s) + '" r="' + f(s * .12) + '" fill="' + darker(m, .65) + '"/>').join(''),
  ham: (s) => '<rect x="' + -s + '" y="' + -s + '" width="' + 2 * s + '" height="' + f(s * 1.7) + '" rx="' + f(s * .35) + '" fill="#F2A0A6" stroke="#FAD3D5" stroke-width="5"/>',
  bacon: (s) => {
    const d = 'M' + -s + ' 0 Q ' + f(-s / 2) + ' ' + f(-s * .45) + ' 0 0 T ' + s + ' 0';
    return '<path d="' + d + '" stroke="#A93226" stroke-width="' + f(s * .5) + '" stroke-linecap="round" fill="none"/><path d="' + d + '" stroke="#F4C3AE" stroke-width="' + f(s * .13) + '" stroke-linecap="round" fill="none"/>';
  },
  chunk: (s, m) => '<path d="M' + -s + ' ' + f(-s * .3) + ' Q ' + f(-s * .8) + ' ' + f(-s * .8) + ' 0 ' + f(-s * .7) + ' Q ' + f(s * .9) + ' ' + f(-s * .7) + ' ' + s + ' 0 Q ' + f(s * .8) + ' ' + f(s * .75) + ' 0 ' + f(s * .7) + ' Q ' + f(-s * .9) + ' ' + f(s * .6) + ' ' + -s + ' ' + f(-s * .3) + 'z" fill="' + m + '" stroke="' + darker(m, .72) + '" stroke-width="3"/>' +
    '<path d="M' + f(-s * .5) + ' ' + f(-s * .1) + ' L' + f(s * .45) + ' ' + f(s * .2) + '" stroke="' + darker(m, .6) + '" stroke-width="3" stroke-linecap="round"/>',
  onion: (s) => '<ellipse rx="' + s + '" ry="' + f(s * .8) + '" fill="none" stroke="#A974AE" stroke-width="5"/><ellipse rx="' + f(s * .62) + '" ry="' + f(s * .48) + '" fill="none" stroke="#E7D3EA" stroke-width="3"/>',
  olive: (s) => '<circle r="' + f(s * .62) + '" fill="none" stroke="#1C1C1C" stroke-width="' + f(s * .42) + '"/>',
  greenOlive: (s) => '<circle r="' + f(s * .62) + '" fill="none" stroke="#7A9A2B" stroke-width="' + f(s * .42) + '"/><circle r="' + f(s * .22) + '" fill="#D9473A"/>',
  pepper: (s) => '<path d="M' + -s + ' 0 A ' + s + ' ' + s + ' 0 0 1 ' + s + ' 0" fill="none" stroke="#2E8B3D" stroke-width="' + f(s * .36) + '" stroke-linecap="round"/>',
  redPepper: (s) => '<path d="M' + -s + ' 0 A ' + s + ' ' + s + ' 0 0 1 ' + s + ' 0" fill="none" stroke="#E0452B" stroke-width="' + f(s * .36) + '" stroke-linecap="round"/>',
  mush: (s) => '<path d="M' + -s + ' 0 A ' + s + ' ' + f(s * .85) + ' 0 0 1 ' + s + ' 0z" fill="#EADBC3" stroke="#B49B78" stroke-width="2.5"/><rect x="' + f(-s * .3) + '" y="-1" width="' + f(s * .6) + '" height="' + f(s * .75) + '" rx="3" fill="#EADBC3" stroke="#B49B78" stroke-width="2.5"/>',
  corn: (s) => '<ellipse rx="' + s + '" ry="' + f(s * 1.15) + '" fill="#FFC21A" stroke="#B87A00" stroke-width="2.5"/><ellipse cx="' + f(-s * .3) + '" cy="' + f(-s * .35) + '" rx="' + f(s * .3) + '" ry="' + f(s * .35) + '" fill="#FFE98A"/>',
  pineapple: (s) => '<path d="M' + -s + ' ' + f(-s * .5) + ' L' + s + ' ' + f(-s * .5) + ' L' + f(s * .55) + ' ' + f(s * .6) + ' L' + f(-s * .55) + ' ' + f(s * .6) + 'z" fill="#FFD94A" stroke="#D49B00" stroke-width="3" stroke-linejoin="round"/><path d="M' + f(-s * .3) + ' ' + f(-s * .4) + ' L' + f(-s * .2) + ' ' + f(s * .5) + 'M' + f(s * .3) + ' ' + f(-s * .4) + ' L' + f(s * .2) + ' ' + f(s * .5) + '" stroke="#E8B400" stroke-width="2"/>',
  paneer: (s) => '<rect x="' + f(-s * .8) + '" y="' + f(-s * .8) + '" width="' + f(s * 1.6) + '" height="' + f(s * 1.6) + '" rx="4" fill="#FFFDF4" stroke="#D3C7AA" stroke-width="3"/><path d="M' + f(-s * .8) + ' ' + f(s * .3) + ' h' + f(s * 1.6) + ' v' + f(s * .5) + ' h' + f(-s * 1.6) + 'z" fill="#EBC383" opacity=".7"/>',
  jalapeno: (s) => '<circle r="' + s + '" fill="#3F8F2A"/><circle r="' + f(s * .62) + '" fill="#D5EBA4"/>' + [[0, -.3], [.28, .18], [-.28, .18]].map(([x, y]) => '<circle cx="' + f(x * s) + '" cy="' + f(y * s) + '" r="' + f(s * .13) + '" fill="#F7F3D2"/>').join(''),
  garlic: (s) => '<path d="M0 ' + -s + ' C ' + f(s * .75) + ' ' + f(-s * .4) + ' ' + f(s * .75) + ' ' + f(s * .6) + ' 0 ' + s + ' C ' + f(-s * .75) + ' ' + f(s * .6) + ' ' + f(-s * .75) + ' ' + f(-s * .4) + ' 0 ' + -s + 'z" fill="#FFF1D0" stroke="#C48A3C" stroke-width="3"/><ellipse cx="' + f(s * .15) + '" cy="' + f(s * .35) + '" rx="' + f(s * .35) + '" ry="' + f(s * .3) + '" fill="#D9973F" opacity=".7"/>',
  tomato: (s) => '<circle r="' + s + '" fill="#E1352A"/><circle r="' + f(s * .7) + '" fill="#F2684D"/>' + [0, 120, 240].map((a) => '<ellipse transform="rotate(' + a + ') translate(0 ' + f(-s * .38) + ')" rx="' + f(s * .14) + '" ry="' + f(s * .22) + '" fill="#FFE1A0"/>').join(''),
  basil: (s) => '<path d="M0 ' + -s + ' C ' + f(s * .8) + ' ' + f(-s * .4) + ' ' + f(s * .6) + ' ' + f(s * .6) + ' 0 ' + s + ' C ' + f(-s * .6) + ' ' + f(s * .6) + ' ' + f(-s * .8) + ' ' + f(-s * .4) + ' 0 ' + -s + 'z" fill="#2E8B3D"/><path d="M0 ' + f(-s * .8) + ' V' + f(s * .8) + '" stroke="#1F6B2B" stroke-width="2"/>',
  tuna: (s) => '<path d="M' + -s + ' 0 Q ' + f(-s * .7) + ' ' + -s + ' 0 ' + f(-s * .6) + ' Q ' + f(s * .9) + ' ' + f(-s * .9) + ' ' + s + ' ' + f(s * .1) + ' Q ' + f(s * .4) + ' ' + f(s * .9) + ' ' + f(-s * .3) + ' ' + f(s * .7) + ' Q ' + f(-s * 1.1) + ' ' + f(s * .5) + ' ' + -s + ' 0z" fill="#EBCBAA" stroke="#C49A72" stroke-width="2.5"/><path d="M' + f(-s * .4) + ' ' + f(-s * .2) + ' q' + f(s * .4) + ' ' + f(s * .3) + ' ' + f(s * .8) + ' 0" stroke="#C49A72" stroke-width="2" fill="none"/>',
  char: (s) => '<ellipse rx="' + s + '" ry="' + f(s * .6) + '" fill="#4A2410" opacity=".3"/>'
};
const SIZE = { pep: 25, salami: 31, sausage: 21, ham: 22, bacon: 40, chunk: 18, onion: 19, olive: 14, greenOlive: 14, pepper: 20, redPepper: 20,
  mush: 21, corn: 10, pineapple: 20, paneer: 16, jalapeno: 15, garlic: 15, tomato: 22, basil: 15, tuna: 17, char: 22 };

// [topping, count] lists. Order matters: later ones sit on top.
const PIZZAS = {
  pepperoni:    { label: 'Pepperoni', top: [['pep', 13]] },
  salami:       { label: 'Salami', top: [['salami', 9], ['basil', 3]] },
  sausage:      { label: 'Sausage', top: [['sausage', 13], ['pepper', 4]] },
  ham:          { label: 'Ham', top: [['ham', 11], ['olive', 4]] },
  bacon:        { label: 'Bacon', top: [['bacon', 8], ['onion', 4]] },
  bbq:          { label: 'BBQ', top: [['chunk', 11], ['onion', 6]], sauce: '#8E3418', drizzle: true },
  smoky:        { label: 'Smoky', top: [['char', 7], ['chunk', 12], ['redPepper', 4]], cheese: '#F3B54C', specks: '#B5241B' },
  lovers:       { label: 'Lovers (mixed meats)', top: [['pep', 5], ['sausage', 5], ['ham', 4], ['bacon', 3]] },
  'meat-lovers':{ label: 'Meat lovers (everything)', top: [['salami', 3], ['pep', 4], ['sausage', 4], ['ham', 3], ['bacon', 3], ['chunk', 4]] },
  hawaiian:     { label: 'Hawaiian (ham & pineapple)', top: [['ham', 8], ['pineapple', 8]] },
  tuna:         { label: 'Tuna', top: [['tuna', 10], ['onion', 5], ['olive', 5]] },
  mix:          { label: 'Mixed meat & veg', top: [['chunk', 7], ['pep', 4], ['pepper', 5], ['olive', 4], ['mush', 3]] },
  cheese:       { label: 'Cheese', top: [], bubbles: 26, specks: '#3D7A2A' },
  veg:          { label: 'Veg (onion, capsicum, tomato)', top: [['tomato', 5], ['onion', 6], ['pepper', 7], ['olive', 4]] },
  'veg-mix':    { label: 'Mixed vegetables', top: [['corn', 9], ['mush', 4], ['tomato', 3], ['pepper', 5], ['olive', 4]] },
  'veg-lovers': { label: 'Veggie lovers (everything)', top: [['corn', 8], ['paneer', 3], ['mush', 4], ['tomato', 3], ['pepper', 4], ['redPepper', 3], ['jalapeno', 3], ['olive', 4]] },
  garlic:       { label: 'Roasted garlic', top: [['garlic', 13], ['basil', 3]], specks: '#3D7A2A' },
  mushroom:     { label: 'Mushroom', top: [['mush', 14]] },
  olive:        { label: 'Olive', top: [['olive', 9], ['greenOlive', 7]] },
  pineapple:    { label: 'Pineapple', top: [['pineapple', 13]] },
  corn:         { label: 'Sweet corn', top: [['corn', 34], ['pepper', 3]] },
  paneer:       { label: 'Paneer', top: [['paneer', 10], ['pepper', 5]] },
  jalapeno:     { label: 'Jalapeño', top: [['jalapeno', 13], ['redPepper', 3]] }
};

function pizzaArt(kind, diet, seed) {
  const p = PIZZAS[kind] || PIZZAS.mix;
  const rand = rng(seed);
  const meat = MEAT[diet] || MEAT.mix;
  let out = '<circle cx="200" cy="208" r="192" fill="#00000026"/>' +
    '<circle cx="200" cy="200" r="192" fill="#E39A42" stroke="#8A4B12" stroke-width="6"/>' +
    '<circle cx="200" cy="200" r="174" fill="#F3BE69"/>' +
    '<circle cx="200" cy="200" r="164" fill="' + (p.sauce || '#D7261E') + '"/>' +
    '<path d="M200 46 C 288 40 360 112 352 204 C 348 292 284 356 198 352 C 116 350 46 286 50 198 C 54 116 120 50 200 46z" fill="' + (p.cheese || '#FFD15C') + '"/>';
  for (let b = 0, n = p.bubbles || 12; b < n; b++) {
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 128;
    out += '<circle cx="' + f(200 + Math.cos(a) * r) + '" cy="' + f(200 + Math.sin(a) * r) + '" r="' + f(12 + rand() * 18) + '" fill="#FFE596" opacity=".6"/>';
    if (p.bubbles && b % 3 === 0) out += '<circle cx="' + f(200 + Math.cos(a + 1) * r * .8) + '" cy="' + f(200 + Math.sin(a + 1) * r * .8) + '" r="' + f(6 + rand() * 6) + '" fill="#E9A23B" opacity=".55"/>';
  }
  // Scatter toppings, keeping them apart where there is room.
  const placed = [];
  p.top.forEach(([t, count]) => {
    const s = SIZE[t];
    for (let i = 0; i < count; i++) {
      let best = null, bestGap = -Infinity;
      for (let k = 0; k < 24; k++) {
        const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * (140 - s * .5);
        const x = 200 + Math.cos(a) * r, y = 200 + Math.sin(a) * r;
        const gap = placed.reduce((g, q) => Math.min(g, Math.hypot(q.x - x, q.y - y) - q.s - s), 999);
        if (gap > bestGap) { best = { x, y, s }; bestGap = gap; }
        if (gap > 4) break;
      }
      placed.push(best);
      out += '<g transform="translate(' + f(best.x) + ' ' + f(best.y) + ') rotate(' + Math.round(rand() * 360) + ')">' + TOP[t](s, meat) + '</g>';
    }
  });
  if (p.specks) for (let i = 0; i < 34; i++) {
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 140;
    out += '<circle cx="' + f(200 + Math.cos(a) * r) + '" cy="' + f(200 + Math.sin(a) * r) + '" r="3.5" fill="' + p.specks + '"/>';
  }
  if (p.drizzle) {
    // Two wavy lines of BBQ sauce.
    const d = 'M84 150 Q 112 112 140 152 T 196 152 T 252 152 T 312 150 M96 246 Q 124 208 152 248 T 208 248 T 264 248 T 312 236';
    out += '<path d="' + d + '" stroke="#4E220E" stroke-width="9" stroke-linecap="round" fill="none"/><path d="' + d + '" stroke="#8A4A22" stroke-width="3" stroke-linecap="round" fill="none"/>';
  }
  let cuts = '';
  for (let s = 0; s < 6; s++) { const a = s / 6 * Math.PI * 2 + .3; cuts += '<line x1="200" y1="200" x2="' + f(200 + Math.cos(a) * 168) + '" y2="' + f(200 + Math.sin(a) * 168) + '"/>'; }
  return svg(out + '<g stroke="#A85F1E" stroke-opacity=".3" stroke-width="3">' + cuts + '</g>', 400);
}

/* ---------- Shared bits (100×100 space) ---------- */

const steam = (x) => '<path d="M' + (x - 12) + ' 22c-4-5 4-8 0-13M' + x + ' 22c-4-5 4-8 0-13M' + (x + 12) + ' 22c-4-5 4-8 0-13" stroke="#B9B1A0" stroke-width="3.5" fill="none" stroke-linecap="round"/>';
const plate = (cy, rx) => '<ellipse cx="50" cy="' + cy + '" rx="' + rx + '" ry="' + f(rx * .3) + '" fill="#fff" stroke="' + INK + '" stroke-width="2.5"/><ellipse cx="50" cy="' + (cy - 1) + '" rx="' + f(rx * .75) + '" ry="' + f(rx * .2) + '" fill="none" stroke="#E7E0D2" stroke-width="2"/>';

// A small round tag in the bottom-right corner (which MoMo, "2×", "+").
const GLYPH = {
  leaf: '<path d="M0 -8 C 7 -4 7 4 0 8 C -7 4 -7 -4 0 -8z" fill="#2E9B44"/><path d="M0 -6 V6" stroke="#1F6B2B" stroke-width="1.5"/>',
  buff: '<path d="M-5 -2 C -10 -3 -11 -8 -8 -10M5 -2 C 10 -3 11 -8 8 -10" stroke="#CDBB92" stroke-width="3" stroke-linecap="round" fill="none"/><ellipse cy="2" rx="6" ry="7" fill="#5A3A2A"/><ellipse cy="6" rx="3.5" ry="2.5" fill="#8A6A55"/>',
  chicken: '<path d="M-1 2 L-6 7" stroke="#FFF3DC" stroke-width="3.5" stroke-linecap="round"/><circle cx="-6.5" cy="7.5" r="2" fill="#FFF3DC"/><circle cx="2" cy="-2" r="6" fill="#D98B32"/>',
  pork: '<circle r="8" fill="#F4A6B5"/><path d="M-7 -5 L-4 -10 L-2 -6zM7 -5 L4 -10 L2 -6z" fill="#E57F97"/><ellipse cy="2" rx="4" ry="3" fill="#E57F97"/><circle cx="-1.5" cy="2" r=".9" fill="' + INK + '"/><circle cx="1.5" cy="2" r=".9" fill="' + INK + '"/>',
  two: '<text y="4.5" font-family="Lilita One, Impact, sans-serif" font-size="13" text-anchor="middle" fill="#E50914">2×</text>',
  plus: '<path d="M0 -6 V6 M-6 0 H6" stroke="#E50914" stroke-width="3.5" stroke-linecap="round"/>',
  fire: '<path d="M0 -9 C 6 -3 7 2 4 6 C 2 9 -3 9 -5 6 C -7 2 -4 -1 -2 -4 C -1 -1 1 0 1 -2 C 2 -4 1 -7 0 -9z" fill="#FF7A1A"/><path d="M0 0 C 3 3 2 6 0 7 C -2 6 -3 3 0 0z" fill="#FFD23F"/>'
};
const badge = (g) => '<g transform="translate(83 82)"><circle r="13" fill="#FFF8E6" stroke="' + INK + '" stroke-width="2.5"/>' + GLYPH[g] + '</g>';

// A golden, bumpy fried piece.
function crispy(cx, cy, rx, ry, rot, seed, fill) {
  const rand = rng(seed), pts = [];
  for (let i = 0; i < 26; i++) {
    const a = i / 26 * Math.PI * 2, k = 1 + .1 * Math.sin(a * 5 + seed) + .05 * Math.sin(a * 11);
    pts.push(f(Math.cos(a) * rx * k) + ' ' + f(Math.sin(a) * ry * k));
  }
  let dots = '';
  for (let i = 0; i < 6; i++) dots += '<circle cx="' + f((rand() - .5) * rx * 1.2) + '" cy="' + f((rand() - .5) * ry * 1.2) + '" r="' + f(1.2 + rand() * 1.2) + '" fill="#00000030"/>';
  return '<g transform="translate(' + cx + ' ' + cy + ') rotate(' + rot + ')"><path d="M' + pts.join(' L') + 'z" fill="' + (fill || '#D98B32') + '" stroke="#7A3E0E" stroke-width="2.2" stroke-linejoin="round"/>' +
    '<path d="M' + f(-rx * .5) + ' ' + f(-ry * .45) + ' q' + f(rx * .4) + ' ' + f(-ry * .25) + ' ' + f(rx * .8) + ' 0" stroke="#ffffff55" stroke-width="2.5" fill="none" stroke-linecap="round"/>' + dots + '</g>';
}
const bone = (x1, y1, x2, y2) => '<path d="M' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2 + '" stroke="' + INK + '" stroke-width="7.5" stroke-linecap="round"/><path d="M' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2 + '" stroke="#FFF3DC" stroke-width="4" stroke-linecap="round"/>' +
  '<circle cx="' + (x2 - 2) + '" cy="' + (y2 - 1) + '" r="3.6" fill="#FFF3DC" stroke="' + INK + '" stroke-width="1.8"/><circle cx="' + (x2 + 1.5) + '" cy="' + (y2 + 2) + '" r="3.6" fill="#FFF3DC" stroke="' + INK + '" stroke-width="1.8"/>';

/* ---------- Chicken ---------- */

const DRUMSTICK = '<path d="M58 18 C 82 16 92 40 80 58 C 70 72 52 70 46 66 L 30 82 C 32 90 22 96 17 88 C 9 90 6 80 14 77 C 8 70 18 62 24 68 L 40 52 C 34 44 36 20 58 18z" fill="#D98B32" stroke="#8a4b12" stroke-width="3"/><path d="M52 28 C 66 26 76 36 72 48" stroke="#F2B35B" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="60" cy="44" r="3" fill="#8a4b12"/><circle cx="68" cy="34" r="2.5" fill="#8a4b12"/>';

function bucket() {
  // Red-and-white striped bucket with three crispy pieces.
  const xl = (y) => 24 + (y - 46) * 7 / 46, xr = (y) => 76 - (y - 46) * 7 / 46;
  const stripe = (a, b) => '<path d="M' + f(xl(46) + a * (xr(46) - xl(46))) + ' 46 L' + f(xl(46) + b * (xr(46) - xl(46))) + ' 46 L' + f(xl(92) + b * (xr(92) - xl(92))) + ' 92 L' + f(xl(92) + a * (xr(92) - xl(92))) + ' 92z" fill="#fff"/>';
  return bone(56, 30, 64, 8) + crispy(34, 38, 15, 12, -20, 3) + crispy(66, 40, 14, 11, 25, 9) + crispy(50, 34, 13, 14, 0, 5) +
    '<path d="M24 46 L76 46 L69 92 L31 92z" fill="#E50914"/>' + stripe(.2, .38) + stripe(.62, .8) +
    '<path d="M24 46 L76 46 L69 92 L31 92z" fill="none" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/>' +
    '<rect x="20" y="41" width="60" height="9" rx="4" fill="#fff" stroke="' + INK + '" stroke-width="3"/>';
}
function wings(hot) {
  const glaze = hot ? '#C9381C' : '#D98B32';
  let out = plate(78, 44) + crispy(30, 62, 17, 9, -25, 2, glaze) + crispy(70, 62, 17, 9, 25, 7, glaze) + crispy(50, 52, 18, 10, -5, 4, glaze) +
    bone(63, 50, 72, 44);
  if (hot) {
    out += [[24, 58], [36, 64], [46, 50], [56, 54], [66, 60], [76, 64]].map(([x, y]) => '<ellipse cx="' + x + '" cy="' + y + '" rx="1.6" ry="1" fill="#FFF3D6"/>').join('') +
      '<path d="M14 78 C 18 70 28 70 32 74 C 26 74 20 78 18 84z" fill="#E0281B" stroke="' + INK + '" stroke-width="2"/><path d="M14 78 l-3 -4" stroke="#2E8B3D" stroke-width="3" stroke-linecap="round"/>' + badge('fire');
  }
  return out;
}

/* ---------- MoMo ---------- */

function dumpling(x, y, s, fill, edge) {
  return '<path d="M' + f(x - s) + ' ' + f(y + s * .55) + ' C ' + f(x - s) + ' ' + f(y - s * .2) + ' ' + f(x - s * .45) + ' ' + f(y - s * .8) + ' ' + x + ' ' + f(y - s * .95) +
    ' C ' + f(x + s * .45) + ' ' + f(y - s * .8) + ' ' + f(x + s) + ' ' + f(y - s * .2) + ' ' + f(x + s) + ' ' + f(y + s * .55) + 'z" fill="' + fill + '" stroke="' + INK + '" stroke-width="2.3" stroke-linejoin="round"/>' +
    '<path d="M' + x + ' ' + f(y - s * .85) + ' Q ' + f(x - s * .35) + ' ' + f(y - s * .3) + ' ' + f(x - s * .55) + ' ' + f(y + s * .3) + 'M' + x + ' ' + f(y - s * .85) + ' Q ' + f(x + s * .35) + ' ' + f(y - s * .3) + ' ' + f(x + s * .55) + ' ' + f(y + s * .3) + 'M' + x + ' ' + f(y - s * .85) + ' L' + x + ' ' + f(y + s * .15) + '" stroke="' + edge + '" stroke-width="2" fill="none" stroke-linecap="round"/>' +
    '<circle cx="' + x + '" cy="' + f(y - s * .95) + '" r="' + f(s * .13) + '" fill="' + fill + '" stroke="' + INK + '" stroke-width="1.8"/>';
}
function momo(g) {
  return steam(50) + plate(76, 44) +
    '<ellipse cx="17" cy="72" rx="10" ry="4.5" fill="#fff" stroke="' + INK + '" stroke-width="2"/><ellipse cx="17" cy="71" rx="7" ry="2.6" fill="#E8562A"/>' +
    dumpling(38, 56, 15, '#FFF8EC', '#D9C7A6') + dumpling(64, 56, 15, '#FFF8EC', '#D9C7A6') + dumpling(51, 66, 16, '#FFFBF3', '#D9C7A6') +
    (g ? badge(g) : '');
}

/* ---------- Sides ---------- */

const FRIES = '<g fill="#FFD84D" stroke="#D98B32" stroke-width="2"><rect x="28" y="14" width="8" height="46" rx="2" transform="rotate(-10 32 37)"/><rect x="40" y="8" width="8" height="50" rx="2"/><rect x="52" y="10" width="8" height="48" rx="2" transform="rotate(6 56 34)"/><rect x="64" y="16" width="8" height="44" rx="2" transform="rotate(14 68 38)"/></g>';
const CARTON = '<path d="M22 40 L 78 40 L 70 92 L 30 92 Z" fill="#E50914" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/><path d="M38 58 Q 50 68 62 58" stroke="#FFC72C" stroke-width="5" fill="none" stroke-linecap="round"/>';
const CHEESE_SAUCE = '<path d="M26 26 C 34 18 44 26 50 20 C 58 14 66 24 74 22 C 78 30 72 34 70 44 C 68 36 64 34 62 40 C 60 34 52 32 50 42 C 48 34 40 34 38 40 C 36 34 30 34 28 44 C 26 36 22 32 26 26z" fill="#FFB81C" stroke="#D88A00" stroke-width="2" stroke-linejoin="round"/><path d="M34 26 q6-3 10 0" stroke="#FFE08A" stroke-width="2.5" fill="none" stroke-linecap="round"/>';
const COMBO = plate(76, 44) +
  '<g fill="#FFD84D" stroke="#D98B32" stroke-width="2"><rect x="60" y="52" width="7" height="30" rx="2" transform="rotate(62 63 67)"/><rect x="64" y="46" width="7" height="30" rx="2" transform="rotate(75 67 61)"/><rect x="58" y="58" width="7" height="28" rx="2" transform="rotate(50 61 72)"/></g>' +
  '<rect x="14" y="52" width="30" height="20" rx="8" fill="#E8AE4A" stroke="#8A4B12" stroke-width="2.2"/>' + [[20, 58], [28, 62], [36, 57], [24, 66], [38, 66]].map(([x, y]) => '<circle cx="' + x + '" cy="' + y + '" r="1.4" fill="#A86A1E"/>').join('') +
  '<circle cx="50" cy="56" r="12" fill="#F2B24E" stroke="#8A4B12" stroke-width="2.2"/><circle cx="46" cy="53" r="1.8" fill="#8A4B12"/><circle cx="54" cy="53" r="1.8" fill="#8A4B12"/><path d="M44 58 Q 50 64 56 58" stroke="#8A4B12" stroke-width="2.2" fill="none" stroke-linecap="round"/>';
const CHEESE_WEDGE = '<path d="M14 62 L60 30 L88 52 L88 76 L14 76z" fill="#F5B82E" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/><path d="M14 62 L60 30 L88 52 L42 62z" fill="#FFD54A" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>' +
  '<ellipse cx="54" cy="46" rx="5" ry="3" fill="#E9A21E"/><ellipse cx="70" cy="52" rx="3.5" ry="2.2" fill="#E9A21E"/><circle cx="30" cy="69" r="3.5" fill="#E9A21E"/><circle cx="60" cy="70" r="4" fill="#E9A21E"/><circle cx="76" cy="66" r="2.5" fill="#E9A21E"/>' + badge('plus');
function bowls() {
  const bowl = (x, inside) => '<g transform="translate(' + x + ' 0)"><path d="M-15 54 A15 13 0 0 0 15 54z" fill="#fff" stroke="' + INK + '" stroke-width="2.5"/><ellipse cy="54" rx="15" ry="4" fill="#F7EEDC" stroke="' + INK + '" stroke-width="2.5"/>' + inside + '</g>';
  return bowl(20, '<circle cx="-5" cy="51" r="4.5" fill="#C8202A"/><circle cx="4" cy="50" r="4.5" fill="#C8202A"/><circle cx="0" cy="54" r="4" fill="#B3121B"/>') +
    bowl(50, '<circle cx="-5" cy="52" r="3" fill="none" stroke="#1C1C1C" stroke-width="2.4"/><circle cx="4" cy="51" r="3" fill="none" stroke="#1C1C1C" stroke-width="2.4"/><circle cx="0" cy="55" r="3" fill="none" stroke="#1C1C1C" stroke-width="2.4"/>') +
    bowl(80, '<path d="M-8 53 a5 5 0 0 1 9 0M0 51 a5 5 0 0 1 9 0M-4 56 a5 5 0 0 1 9 0" stroke="#2E8B3D" stroke-width="2.6" fill="none" stroke-linecap="round"/>') +
    '<g transform="translate(50 82)"><circle r="12" fill="#FFF8E6" stroke="' + INK + '" stroke-width="2.5"/>' + GLYPH.plus + '</g>';
}

/* ---------- Drinks ---------- */

const saucer = (cy, rx) => '<ellipse cx="50" cy="' + cy + '" rx="' + rx + '" ry="' + f(rx * .2) + '" fill="#FFF6E5" stroke="' + INK + '" stroke-width="3"/>';

// Cappuccino-style cup on a saucer; `top` draws the surface (foam, cream...).
function cup(liquid, top, band) {
  return '<path d="M74 44h4a10 10 0 0 1 0 20h-6" fill="none" stroke="' + INK + '" stroke-width="5"/>' + saucer(84, 38) +
    '<path d="M22 32h56l-6 42c-1 6-6 8-12 8H40c-6 0-11-2-12-8z" fill="#FFF6E5" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/>' +
    '<path d="M25 52h50l-1.4 10H26.4z" fill="' + (band || '#E50914') + '"/>' +
    '<ellipse cx="50" cy="33" rx="27" ry="5" fill="' + liquid + '" stroke="' + INK + '" stroke-width="3"/>' + (top || '');
}
const FOAM_HEART = '<ellipse cx="50" cy="33" rx="22" ry="3.6" fill="#F3E3CB"/><path d="M50 35.5 C 44 32 45 29.5 48 30.5 L50 31.5 L52 30.5 C 55 29.5 56 32 50 35.5z" fill="#A86A3A"/>';
const COCOA = [[38, 33], [60, 32], [44, 34.5], [57, 34.5]].map(([x, y]) => '<circle cx="' + x + '" cy="' + y + '" r=".9" fill="#7A4A23"/>').join('');
const CREAM_CUP = '<path d="M28 33 C 26 24 36 22 38 24 C 40 16 50 15 52 20 C 56 13 68 18 64 24 C 72 23 74 30 72 33z" fill="#FFFDF7" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/><path d="M34 27 L40 24 L46 28 L52 22 L58 27 L64 24" stroke="#5A2E14" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';

function demitasse() {
  return steam(50) + '<path d="M64 56h3a7 7 0 0 1 0 14h-4" fill="none" stroke="' + INK + '" stroke-width="4"/>' + saucer(82, 30) +
    '<path d="M32 50h36l-4 22c-1 5-5 7-10 7h-8c-5 0-9-2-10-7z" fill="#FFF6E5" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/>' +
    '<ellipse cx="50" cy="51" rx="18" ry="4" fill="#B97A40" stroke="' + INK + '" stroke-width="2.5"/><ellipse cx="50" cy="51" rx="11" ry="2" fill="#5A3218"/>';
}

// Tall mug; `body` is the mug colour, `liquid` the drink, `extra` sits on top.
function mug(body, liquid, extra) {
  return steam(48) + '<path d="M68 42h5a11 11 0 0 1 0 22h-5" fill="none" stroke="' + INK + '" stroke-width="5"/>' +
    '<rect x="26" y="30" width="44" height="56" rx="7" fill="' + body + '" stroke="' + INK + '" stroke-width="3"/>' +
    '<ellipse cx="48" cy="31" rx="20" ry="4.5" fill="' + liquid + '" stroke="' + INK + '" stroke-width="2.5"/>' + (extra || '');
}

// Tumbler from y=18 to y=90; layers are [fromY, toY, colour] bottom-up.
function glass(layers, o) {
  o = o || {};
  const xl = (y) => 28 + (y - 18) * 6 / 72, xr = (y) => 72 - (y - 18) * 6 / 72;
  const band = (y1, y2, c) => '<path d="M' + f(xl(y1)) + ' ' + y1 + ' L' + f(xr(y1)) + ' ' + y1 + ' L' + f(xr(y2)) + ' ' + y2 + ' L' + f(xl(y2)) + ' ' + y2 + 'z" fill="' + c + '"/>';
  let out = (o.steam ? steam(50) : '') + '<path d="M28 18 L72 18 L66 90 L34 90z" fill="#EEF7FA"/>';
  layers.forEach(([a, b, c]) => { out += band(a, b, c); });
  if (o.ice) out += [[36, 30, -10], [52, 26, 8], [44, 40, 20]].map(([x, y, r]) => '<rect x="' + x + '" y="' + y + '" width="13" height="13" rx="3" transform="rotate(' + r + ' ' + (x + 6) + ' ' + (y + 6) + ')" fill="#ffffff99" stroke="#8FC1D4" stroke-width="2"/>').join('');
  if (o.straw) out += '<path d="M58 4 L54 70" stroke="' + INK + '" stroke-width="7" stroke-linecap="round"/><path d="M58 4 L54 70" stroke="' + o.straw + '" stroke-width="4" stroke-linecap="round"/>';
  out += '<path d="M28 18 L72 18 L66 90 L34 90z" fill="none" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/><path d="M33 26 L37 82" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>';
  if (o.cream) out += '<path d="M26 20 C 22 12 32 8 36 11 C 38 3 50 2 52 8 C 56 1 70 5 66 12 C 74 10 78 17 74 20z" fill="#FFFDF7" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>' +
    (o.drizzle ? '<path d="M32 14 L38 11 L44 15 L50 9 L56 14 L62 10 L68 15" stroke="' + o.drizzle + '" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' : '');
  return out + (o.extra || '');
}

// Plastic cup with a dome lid and straw (frappes).
function frappe(liquid, cream, extra) {
  return '<path d="M54 2 L50 44" stroke="' + INK + '" stroke-width="7" stroke-linecap="round"/><path d="M54 2 L50 44" stroke="#E50914" stroke-width="4" stroke-linecap="round"/>' +
    '<path d="M31 36 C 28 26 38 22 42 25 C 44 18 56 18 58 24 C 64 20 72 27 69 36z" fill="#FFFDF7" stroke="' + INK + '" stroke-width="2.2"/>' + (cream || '') +
    '<path d="M27 36 A23 20 0 0 1 73 36z" fill="#ffffff55" stroke="' + INK + '" stroke-width="2.5"/>' +
    '<path d="M30 38 L70 38 L65 92 L35 92z" fill="' + liquid + '" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/>' +
    '<rect x="26" y="35" width="48" height="5" rx="2.5" fill="#fff" stroke="' + INK + '" stroke-width="2.5"/>' +
    '<path d="M36 46 L39 86" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".55"/>' + (extra || '');
}

// Small straight Nepali tea glass.
const chaiGlass = (tea) => steam(50) + '<path d="M34 34 L66 34 L62 86 L38 86z" fill="' + tea + '" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/>' +
  '<path d="M34 34 L66 34 L65.3 42 L34.7 42z" fill="#E9CDA6" stroke="' + INK + '" stroke-width="2"/><path d="M39 46 L42 80" stroke="#fff" stroke-width="2.5" opacity=".5" stroke-linecap="round"/>';

const LEMON = (x, y, r) => '<g transform="translate(' + x + ' ' + y + ')"><circle r="' + r + '" fill="#FFE34D" stroke="#C99A00" stroke-width="2"/><circle r="' + f(r * .72) + '" fill="#FFF3A6"/>' +
  [0, 60, 120].map((a) => '<path transform="rotate(' + a + ')" d="M0 ' + f(-r * .7) + ' V' + f(r * .7) + '" stroke="#F2D23A" stroke-width="1.6"/>').join('') + '</g>';
const TEA_TAG = '<path d="M58 30 Q 70 34 74 48" stroke="#8A7A66" stroke-width="1.5" fill="none"/><rect x="69" y="47" width="11" height="13" rx="1.5" fill="#fff" stroke="' + INK + '" stroke-width="2"/><rect x="71.5" y="50" width="6" height="7" fill="#E50914"/>';
const HONEY_DIPPER = '<path d="M78 8 L62 34" stroke="#8A5A2B" stroke-width="3.5" stroke-linecap="round"/><g transform="translate(80 6) rotate(-58)"><rect x="-6" y="-4" width="14" height="9" rx="3" fill="#F2B233" stroke="' + INK + '" stroke-width="1.8"/><path d="M-2 -4 V5 M3 -4 V5" stroke="#C98612" stroke-width="1.6"/></g><path d="M64 31 C 64 36 61 37 61 41" stroke="#F2B233" stroke-width="3" stroke-linecap="round" fill="none"/>';
const GINGER = '<path d="M74 80 C 72 72 80 70 82 74 C 86 70 94 74 90 80 C 94 84 88 90 84 86 C 80 90 72 88 74 80z" fill="#E7C27D" stroke="#8A6A3A" stroke-width="2"/><path d="M80 78 l3 3M86 80 l2 -2" stroke="#B48A4A" stroke-width="1.6" stroke-linecap="round"/>';
const APPLE = '<path d="M82 66 C 92 62 98 72 94 82 C 91 90 86 90 82 88 C 78 90 73 90 70 82 C 66 72 72 62 82 66z" fill="#D7262E" stroke="' + INK + '" stroke-width="2"/><path d="M82 66 Q 83 60 86 58" stroke="#6A3A1A" stroke-width="2" fill="none"/><path d="M84 61 C 89 57 93 60 92 62 C 89 64 86 63 84 61z" fill="#3E9B3A"/><path d="M74 72 q2 -3 5 -3" stroke="#ffffff88" stroke-width="2" fill="none" stroke-linecap="round"/>';
const PEACH = '<circle cx="82" cy="78" r="12" fill="#F7A25E" stroke="' + INK + '" stroke-width="2"/><path d="M82 66 C 78 72 78 84 82 90" stroke="#E07E40" stroke-width="2" fill="none"/><path d="M83 66 C 88 60 94 62 93 65 C 90 67 86 67 83 66z" fill="#3E9B3A"/><circle cx="76" cy="74" r="3" fill="#FFC79A"/>';

function cans() {
  const can = (x, y, body, label) => '<g transform="translate(' + x + ' ' + y + ')"><rect x="0" y="0" width="22" height="46" rx="4" fill="' + body + '" stroke="' + INK + '" stroke-width="2.5"/>' +
    '<rect x="2" y="-3" width="18" height="6" rx="3" fill="#D4D4D4" stroke="' + INK + '" stroke-width="2"/><path d="M0 20 C 7 14 15 30 22 22" stroke="' + label + '" stroke-width="4" fill="none"/><path d="M5 6 V40" stroke="#ffffff66" stroke-width="2.5" stroke-linecap="round"/></g>';
  return can(12, 40, '#2F9E44', '#FFE14A') + can(64, 40, '#F47B20', '#1D4FA0') + can(38, 30, '#D9161E', '#ffffff');
}
const BOTTLE = '<path d="M44 6 h12 v8 h-12z" fill="#1E6FD9" stroke="' + INK + '" stroke-width="2.5"/><path d="M45 14 h10 v6 c0 4 10 8 10 18 v48 c0 4-3 6-7 6 h-16 c-4 0-7-2-7-6 v-48 c0-10 10-14 10-18z" fill="#CBEBF7" stroke="' + INK + '" stroke-width="2.8" stroke-linejoin="round"/>' +
  '<path d="M36 46 h28 M36 74 h28" stroke="#9CCBE0" stroke-width="2"/><rect x="35" y="52" width="30" height="16" fill="#fff" stroke="' + INK + '" stroke-width="2"/><path d="M50 55 C 47 59 46 61 46 62.5 a4 4 0 0 0 8 0 C 54 61 53 59 50 55z" fill="#1E6FD9"/><path d="M41 24 C 38 30 38 36 38 40" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/>';
const OREO = '<g transform="translate(60 22) rotate(-18)"><rect x="-9" y="-6" width="18" height="12" rx="4" fill="#2B2B2B" stroke="' + INK + '" stroke-width="1.5"/><rect x="-8.5" y="-1.4" width="17" height="2.8" fill="#FFF8EC"/></g>';
const SODA_CUP = '<path d="M58 6 L 54 30" stroke="' + INK + '" stroke-width="5" stroke-linecap="round"/><path d="M26 28 L 74 28 L 66 94 L 34 94 Z" fill="#E50914" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/><rect x="22" y="22" width="56" height="10" rx="4" fill="#fff" stroke="' + INK + '" stroke-width="3"/><path d="M32 52 L 68 52 L 66 70 L 34 70 Z" fill="#fff"/><text x="50" y="66" font-family="Lilita One, sans-serif" font-size="12" text-anchor="middle" fill="#E50914">OMC</text>';

const COFFEE = '#3B2314', MILK_COFFEE = '#B98458';

/* ---------- Catalogue ---------- */

// group → [key, label, draw(item)] — the order here is the order in the dashboard picker.
const GROUPS = [
  ['Pizza', Object.keys(PIZZAS).map((k) => ['pizza-' + k, PIZZAS[k].label, (it) => pizzaArt(k, it.diet, hashStr(k + (it.diet || '')))])],
  ['Chicken', [
    ['fried-chicken', 'Fried chicken bucket', () => svg(bucket())],
    ['wings', 'Wings', () => svg(wings(false))],
    ['hot-wings', 'Hot wings', () => svg(wings(true))],
    ['drumstick', 'Drumstick', () => svg(DRUMSTICK)]
  ]],
  ['MoMo', [
    ['momo-veg', 'Veg MoMo', () => svg(momo('leaf'))],
    ['momo-buff', 'Buff MoMo', () => svg(momo('buff'))],
    ['momo-chicken', 'Chicken MoMo', () => svg(momo('chicken'))],
    ['momo-pork', 'Pork MoMo', () => svg(momo('pork'))],
    ['momo', 'MoMo (plain)', () => svg(momo(''))]
  ]],
  ['Sides & add-ons', [
    ['fries', 'French fries', () => svg(FRIES + CARTON)],
    ['cheese-fries', 'Cheese fries', () => svg(FRIES + CHEESE_SAUCE + CARTON)],
    ['veggie-combo', 'Veggie combo plate', () => svg(COMBO)],
    ['extra-cheese', 'Extra cheese', () => svg(CHEESE_WEDGE)],
    ['extra-toppings', 'Extra toppings', () => svg(bowls())]
  ]],
  ['Coffee', [
    ['espresso', 'Espresso', () => svg(demitasse())],
    ['americano', 'Americano', () => svg(mug('#E50914', COFFEE))],
    ['double-americano', 'Double americano', () => svg(mug('#E50914', COFFEE, badge('two')))],
    ['cappuccino', 'Cappuccino', () => svg(steam(50) + cup('#F3E3CB', FOAM_HEART + COCOA))],
    ['double-cappuccino', 'Double cappuccino', () => svg(steam(50) + cup('#F3E3CB', FOAM_HEART + COCOA) + badge('two'))],
    ['latte', 'Latte', () => svg(glass([[52, 90, MILK_COFFEE], [26, 52, '#E9D2B4'], [18, 26, '#FFF8EC']], { steam: true }))],
    ['latte-macchiato', 'Latte macchiato', () => svg(glass([[58, 90, '#F6EBDD'], [42, 58, '#7A4A23'], [18, 42, '#FFF8EC']], { steam: true }))],
    ['honey-latte', 'Honey latte', () => svg(glass([[48, 90, MILK_COFFEE], [26, 48, '#E9D2B4'], [18, 26, '#FFF8EC']], { extra: HONEY_DIPPER }))],
    ['mocha', 'Café mocha', () => svg(cup('#5A2E14', CREAM_CUP, '#5A2E14'))],
    ['mocha-madness', 'Mocha madness', () => svg(glass([[60, 90, '#4A2410'], [40, 60, '#8A5230'], [18, 40, '#5A2E14']], { cream: true, drizzle: '#4A2410' }))],
    ['shakerato', 'Iced shakerato', () => svg('<path d="M18 26 L82 26 L50 60z" fill="#EEF7FA" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/><path d="M24.5 32 L75.5 32 L50 58z" fill="#3B2314"/><path d="M21 28 L79 28 L75.5 32 L24.5 32z" fill="#D9B48A"/><path d="M18 26 L82 26 L50 60z" fill="none" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/><path d="M50 60 V84" stroke="' + INK + '" stroke-width="4"/><ellipse cx="50" cy="86" rx="16" ry="4" fill="#EEF7FA" stroke="' + INK + '" stroke-width="3"/>' + '<circle cx="66" cy="16" r="5" fill="#ffffff99" stroke="#8FC1D4" stroke-width="2"/>')],
    ['iced-americano', 'Iced americano', () => svg(glass([[24, 90, '#4A2A16']], { ice: true, straw: '#ffffff' }))],
    ['iced-cappuccino', 'Iced cappuccino', () => svg(glass([[50, 90, '#6B3E1E'], [26, 50, '#D8B48C'], [18, 26, '#FFF8EC']], { ice: true, straw: '#E50914' }))],
    ['blended-mocha', 'Blended mocha', () => svg(frappe('#7A4A2A', '<path d="M38 28 L44 25 L50 29 L56 24 L62 28" stroke="#3B1E0C" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'))],
    ['frappe', 'Café frappe', () => svg(frappe('#C9A27A', '<path d="M38 28 L44 25 L50 29 L56 24 L62 28" stroke="#D98B1E" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'))],
    ['oreo-frappe', 'Oreo frappe', () => svg(frappe('#D9D4CC', OREO, [[40, 52], [52, 60], [58, 48], [44, 72], [56, 78], [48, 84], [38, 64]].map(([x, y]) => '<circle cx="' + x + '" cy="' + y + '" r="2" fill="#2B2B2B"/>').join('')))],
    ['coffee', 'Coffee (plain)', () => svg(steam(50) + cup('#7A4A23'))]
  ]],
  ['Tea & hot drinks', [
    ['milk-tea', 'Milk tea', () => svg(chaiGlass('#C89A6A'))],
    ['black-tea', 'Black tea', () => svg(steam(46) + cup('#8B3A0E', '', '#2E8B3D') + TEA_TAG)],
    ['lemon-tea', 'Lemon tea', () => svg(glass([[26, 90, '#C2661A']], { steam: true, extra: LEMON(70, 22, 11) }))],
    ['hot-lemon', 'Hot lemon', () => svg(mug('#FFF6E5', '#F6E27A', LEMON(30, 30, 10)))],
    ['ginger-lemon', 'Ginger lemon honey', () => svg(mug('#FFF6E5', '#F2CE5A', LEMON(28, 30, 9)) + GINGER)],
    ['apple-tea', 'Apple tea', () => svg(steam(44) + cup('#D9862E', '', '#D7262E') + APPLE)],
    ['peach-tea', 'Peach tea', () => svg(steam(44) + cup('#F09A4A', '', '#F7A25E') + PEACH)],
    ['hot-milk', 'Hot milk', () => svg(mug('#FFC72C', '#FFFDF7'))]
  ]],
  ['Cold drinks', [
    ['soft-drinks', 'Soft drink cans', () => svg(cans())],
    ['water', 'Water bottle', () => svg(BOTTLE)],
    ['drink', 'Soda cup', () => svg(SODA_CUP)]
  ]]
];

const BY_KEY = {};
GROUPS.forEach(([group, list]) => list.forEach(([key, label, draw]) => { BY_KEY[key] = { key, label, group, draw }; }));

/** For the dashboard picker: [{ group, items: [{ key, label }] }]. */
export const ART_GROUPS = GROUPS.map(([group, list]) => ({ group, items: list.map(([key, label]) => ({ key, label })) }));
export const artLabel = (key) => (BY_KEY[key] ? BY_KEY[key].label : '');

// Name rules for items without a chosen drawing. First match wins.
const RULES = [
  [/hawaiian/, 'pizza-hawaiian'], [/meat\s*lovers/, 'pizza-meat-lovers'], [/veg\w*\s*lovers/, 'pizza-veg-lovers'], [/lovers/, 'pizza-lovers'],
  [/bbq|barbe/, 'pizza-bbq'], [/smok/, 'pizza-smoky'], [/salami/, 'pizza-salami'], [/sausage/, 'pizza-sausage'], [/bacon/, 'pizza-bacon'],
  [/pepperoni/, 'pizza-pepperoni'], [/\bham\b/, 'pizza-ham'], [/tuna|fish|prawn/, 'pizza-tuna'], [/mix\w*\s*veg/, 'pizza-veg-mix'],
  [/garlic/, 'pizza-garlic'], [/mushroom/, 'pizza-mushroom'], [/olive/, 'pizza-olive'], [/pineapple/, 'pizza-pineapple'], [/corn/, 'pizza-corn'],
  [/paneer/, 'pizza-paneer'], [/jalap/, 'pizza-jalapeno'], [/mix|special|supreme/, 'pizza-mix'], [/cheese|margher/, 'pizza-cheese']
];
const OTHER_RULES = [
  [/hot\s*wing|spicy\s*wing|buffalo\s*wing/, 'hot-wings'], [/wing/, 'wings'], [/fried\s*chicken|crispy|bucket|broast/, 'fried-chicken'],
  [/drumstick|leg piece/, 'drumstick'],
  [/extra\s*cheese/, 'extra-cheese'], [/topping/, 'extra-toppings'], [/fries.*cheese|cheese.*fries/, 'cheese-fries'], [/combo|hash|smiley|platter/, 'veggie-combo'], [/fries|chips/, 'fries'],
  [/shakerato/, 'shakerato'], [/oreo/, 'oreo-frappe'], [/blended|mocha.*frap/, 'blended-mocha'], [/frap|freddo|smoothie|shake/, 'frappe'],
  [/iced.*americano|cold\s*brew/, 'iced-americano'], [/iced.*(cappuccino|latte)/, 'iced-cappuccino'],
  [/mocha\s*madness/, 'mocha-madness'], [/mocha|hot\s*choc/, 'mocha'], [/honey.*latte/, 'honey-latte'], [/macchiato/, 'latte-macchiato'], [/latte/, 'latte'],
  [/double.*cappuccino/, 'double-cappuccino'], [/cappuccino/, 'cappuccino'], [/double.*americano/, 'double-americano'], [/americano|black\s*coffee/, 'americano'],
  [/espresso|ristretto/, 'espresso'],
  [/ginger/, 'ginger-lemon'], [/lemon\s*tea|iced\s*tea/, 'lemon-tea'], [/lemon/, 'hot-lemon'], [/apple/, 'apple-tea'], [/peach/, 'peach-tea'],
  [/black\s*tea|green\s*tea/, 'black-tea'], [/tea|chiya|chai/, 'milk-tea'], [/milk/, 'hot-milk'], [/coffee/, 'coffee'],
  [/coke|fanta|sprite|pepsi|soda|cola|can\b/, 'soft-drinks'], [/water/, 'water'], [/juice|lassi|drink/, 'drink']
];
const MOMO_GLYPH = { veg: 'momo-veg', buff: 'momo-buff', chicken: 'momo-chicken', pork: 'momo-pork' };

/** The drawing key an item should use: its own choice, else a guess from its name and category. */
export function artKey(item) {
  if (item.art && BY_KEY[item.art]) return item.art;
  const n = String(item.name || '').toLowerCase();
  if (/mo:?mo|dumpling/.test(n)) return MOMO_GLYPH[item.diet] || 'momo';
  const pizzaLike = item.isPizza || /pizza/.test(n);
  if (pizzaLike) {
    const r = RULES.find(([re]) => re.test(n));
    return r ? r[1] : item.diet === 'veg' ? 'pizza-veg' : 'pizza-mix';
  }
  const r = OTHER_RULES.find(([re]) => re.test(n));
  if (r) return r[1];
  if (item.category === 'drinks') return 'coffee';
  return 'drumstick';
}

const cache = new Map();
/** SVG markup for an item (or for a catalogue key with a sample diet, for the picker). */
export function artSvg(item) {
  const key = artKey(item);
  const id = key + '|' + (key.startsWith('pizza-') ? item.diet || '' : '');
  if (!cache.has(id)) cache.set(id, BY_KEY[key].draw(item));
  return cache.get(id);
}
