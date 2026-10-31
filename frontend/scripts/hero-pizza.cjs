/* Generates the floating pizza in the home-page hero (src/assets/hero-pizza-*.webp):
   a textured, top-down pizza on a transparent background, with no outlines.
   Run after changing it:  node frontend/scripts/hero-pizza.cjs
   To use a real photo instead, replace those files with a transparent cut-out. */
const path = require('path');
const sharp = require(require.resolve('sharp', { paths: [path.join(__dirname, '../../backend')] }));

const S = 1000, C = S / 2;
let seed = 22;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const f = (n) => +n.toFixed(1);

// Keep toppings apart, inside the cheese.
const placed = [];
function spot(r, inner = 0, outer = 345) {
  let best = null, gap = -Infinity;
  for (let i = 0; i < 40; i++) {
    const a = rnd() * Math.PI * 2, d = inner + Math.sqrt(rnd()) * (outer - inner - r);
    const x = C + Math.cos(a) * d, y = C + Math.sin(a) * d;
    const g = placed.reduce((m, p) => Math.min(m, Math.hypot(p.x - x, p.y - y) - p.r - r), 999);
    if (g > gap) { gap = g; best = { x, y, r }; }
  }
  placed.push(best);
  return best;
}

function pepperoni() {
  const { x, y, r } = spot(43 + rnd() * 8, 0, 372);
  const id = 'p' + placed.length;
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rnd() * 360)})" filter="url(#lift)">
    <circle r="${r}" fill="url(#pep)" filter="url(#rough)"/>
    <circle r="${f(r * .9)}" fill="none" stroke="#3E0B07" stroke-width="${f(r * .16)}" opacity=".55" filter="url(#soft)"/>
    <circle r="${f(r * .6)}" fill="#E0562F" opacity=".22" filter="url(#soft4)"/>
    ${[[.3, .2, .1], [-.25, .35, .08], [.05, -.42, .07], [.45, -.25, .06], [-.45, -.1, .07]].map(([a, b, c]) => `<circle cx="${f(a * r)}" cy="${f(b * r)}" r="${f(c * r)}" fill="#F2B98A" opacity=".2"/>`).join('')}
  </g>`;
}
function basil() {
  const { x, y, r } = spot(28, 0, 372);
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rnd() * 360)})" filter="url(#lift)">
    <path d="M0 ${-r} C ${f(r * .85)} ${f(-r * .5)} ${f(r * .7)} ${f(r * .55)} 0 ${r} C ${f(-r * .7)} ${f(r * .55)} ${f(-r * .85)} ${f(-r * .5)} 0 ${-r}z" fill="url(#leaf)"/>
    <path d="M0 ${f(-r * .85)} V${f(r * .85)} M0 ${f(-r * .3)} L${f(r * .4)} ${f(-r * .55)} M0 ${f(-r * .3)} L${f(-r * .4)} ${f(-r * .55)} M0 ${f(r * .2)} L${f(r * .42)} ${f(-r * .08)} M0 ${f(r * .2)} L${f(-r * .42)} ${f(-r * .08)}" stroke="#1F4D1B" stroke-width="2" fill="none" opacity=".55"/>
  </g>`;
}
function olive() {
  const { x, y } = spot(16, 0, 372);
  return `<g transform="translate(${f(x)} ${f(y)})" filter="url(#lift)"><circle r="13" fill="none" stroke="#1E1A1C" stroke-width="9"/></g>`;
}
const toppings = [];
for (let i = 0; i < 19; i++) toppings.push(pepperoni());
for (let i = 0; i < 8; i++) toppings.push(basil());
for (let i = 0; i < 6; i++) toppings.push(olive());

let specks = '';
for (let i = 0; i < 120; i++) {
  const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 385;
  specks += `<circle cx="${f(C + Math.cos(a) * d)}" cy="${f(C + Math.sin(a) * d)}" r="${f(1.4 + rnd() * 1.8)}" fill="#2E4A1E" opacity=".7"/>`;
}
let cuts = '';
for (let i = 0; i < 4; i++) {
  const a = i / 4 * Math.PI + .28, dx = Math.cos(a) * 412, dy = Math.sin(a) * 412;
  cuts += `<line x1="${f(C - dx)}" y1="${f(C - dy)}" x2="${f(C + dx)}" y2="${f(C + dy)}"/>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
<defs>
  <radialGradient id="crust" cx="50%" cy="50%" r="50%">
    <stop offset=".82" stop-color="#8E5420"/><stop offset=".875" stop-color="#D9973F"/><stop offset=".93" stop-color="#E9B666"/><stop offset=".97" stop-color="#B9772C"/><stop offset="1" stop-color="#5E3512"/>
  </radialGradient>
  <radialGradient id="cheese" cx="46%" cy="44%" r="58%">
    <stop offset="0" stop-color="#FBD570"/><stop offset=".72" stop-color="#F4B740"/><stop offset="1" stop-color="#CF7F22"/>
  </radialGradient>
  <radialGradient id="pep" cx="42%" cy="40%" r="62%">
    <stop offset="0" stop-color="#B8301F"/><stop offset=".7" stop-color="#96200F"/><stop offset="1" stop-color="#4E0F08"/>
  </radialGradient>
  <linearGradient id="leaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3F7F2E"/><stop offset="1" stop-color="#1B4A17"/></linearGradient>
  <linearGradient id="mush" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2E6D3"/><stop offset="1" stop-color="#C9B193"/></linearGradient>
  <radialGradient id="light" cx="34%" cy="28%" r="80%">
    <stop offset="0" stop-color="#fff" stop-opacity=".2"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#2A1205" stop-opacity=".38"/>
  </radialGradient>
  <!-- Baked crust: bumpy, with dark blisters -->
  <filter id="crustTex" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency=".018" numOctaves="5" seed="4" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="22" result="edge"/>
    <feDiffuseLighting in="n" surfaceScale="13" diffuseConstant="1.05" lighting-color="#fff" result="lit"><feDistantLight azimuth="235" elevation="58"/></feDiffuseLighting>
    <feComposite in="lit" in2="edge" operator="arithmetic" k1="1.2" k2="0" k3="0" k4="0" result="m"/>
    <feComposite in="m" in2="edge" operator="in"/>
  </filter>
  <!-- Melted cheese: soft lumps -->
  <filter id="cheeseTex" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency=".014" numOctaves="4" seed="9" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="26" result="edge"/>
    <feDiffuseLighting in="n" surfaceScale="11" diffuseConstant="1.08" lighting-color="#fff" result="lit"><feDistantLight azimuth="235" elevation="62"/></feDiffuseLighting>
    <feComposite in="lit" in2="edge" operator="arithmetic" k1="1.12" k2="0" k3="0" k4="0" result="m"/>
    <feComposite in="m" in2="edge" operator="in"/>
  </filter>
  <!-- Browned, baked patches on the cheese -->
  <filter id="brown" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency=".03" numOctaves="4" seed="17"/>
    <feColorMatrix values="0 0 0 0 .55  0 0 0 0 .26  0 0 0 0 .05  0 0 0 6 -3.2"/>
    <feGaussianBlur stdDeviation="4"/>
    <feComposite in2="SourceAlpha" operator="in"/>
  </filter>
  <!-- Charred blisters on the crust -->
  <filter id="char" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency=".04" numOctaves="3" seed="31"/>
    <feColorMatrix values="0 0 0 0 .17  0 0 0 0 .08  0 0 0 0 .03  0 0 0 11 -6.9"/>
    <feGaussianBlur stdDeviation="1.8"/>
    <feComposite in2="SourceAlpha" operator="in"/>
  </filter>
  <filter id="rough"><feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="2" seed="5" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="6"/></filter>
  <filter id="lift" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="2" dy="4" stdDeviation="3.5" flood-color="#4A2206" flood-opacity=".55"/></filter>
  <filter id="soft"><feGaussianBlur stdDeviation="1.2"/></filter>
  <filter id="soft4"><feGaussianBlur stdDeviation="5"/></filter>
  <!-- Cheese that has melted over the toppings -->
  <filter id="melt" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency=".02" numOctaves="4" seed="41"/>
    <feColorMatrix values="0 0 0 0 .98  0 0 0 0 .78  0 0 0 0 .36  0 0 0 8 -4.7"/>
    <feGaussianBlur stdDeviation="2.5"/>
    <feComposite in2="SourceAlpha" operator="in"/>
  </filter>
  <mask id="ring"><circle cx="${C}" cy="${C}" r="490" fill="#fff"/><circle cx="${C}" cy="${C}" r="412" fill="#000"/></mask>
</defs>
<circle cx="${C}" cy="${C}" r="476" fill="url(#crust)" filter="url(#crustTex)"/>
<circle cx="${C}" cy="${C}" r="476" fill="#000" filter="url(#char)" mask="url(#ring)"/>
<circle cx="${C}" cy="${C}" r="414" fill="#8E2A12" filter="url(#rough)"/>
<circle cx="${C}" cy="${C}" r="404" fill="url(#cheese)" filter="url(#cheeseTex)"/>
<circle cx="${C}" cy="${C}" r="396" fill="#000" filter="url(#brown)"/>
<g stroke="#5A2F0E" stroke-width="4" opacity=".42" filter="url(#soft)">${cuts}</g>
${toppings.join('')}
<circle cx="${C}" cy="${C}" r="400" fill="#000" filter="url(#melt)" opacity=".85"/>
${specks}
<circle cx="${C}" cy="${C}" r="460" fill="url(#light)"/>
</svg>`;

(async () => {
  const png = await sharp(Buffer.from(svg), { density: 72 }).png().toBuffer();
  for (const w of [480, 900]) {
    const file = path.join(__dirname, '../src/assets/hero-pizza-' + w + '.webp');
    const info = await sharp(png).resize({ width: w }).webp({ quality: 80, alphaQuality: 85, effort: 6 }).toFile(file);
    console.log('hero-pizza-' + w + '.webp', Math.round(info.size / 1024) + ' KB');
  }
})();
