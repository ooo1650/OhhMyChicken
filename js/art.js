/* ==========================================================================
   Art — hand-built SVG illustrations (pizza, rider, toppings, food icons).
   Pure strings, so they are crisp at any size and cost zero image requests.
   ========================================================================== */
(function (OMC) {
  'use strict';

  var uidCounter = 0;

  // Deterministic PRNG so the same pizza always looks the same.
  function rng(seed) {
    var s = seed >>> 0 || 1;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  var TOPPING_SETS = {
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
    var id = (o.id || 'p') + '_' + (++uidCounter);
    var set = TOPPING_SETS[o.diet] || TOPPING_SETS.hero;
    var rand = rng(o.seed || 7);
    var cx = 200, cy = 200, parts = [];

    // Cheese blobs
    var blobs = '';
    for (var b = 0; b < 14; b++) {
      var ba = rand() * Math.PI * 2, br = rand() * 120;
      blobs += '<circle cx="' + (cx + Math.cos(ba) * br).toFixed(1) + '" cy="' + (cy + Math.sin(ba) * br).toFixed(1) + '" r="' + (18 + rand() * 22).toFixed(1) + '" fill="#FFE07A" opacity=".55"/>';
    }

    // Toppings arranged on rings with jitter
    var rings = [[0, 1], [52, 6], [100, 10], [138, 14]];
    rings.forEach(function (ring) {
      for (var i = 0; i < ring[1]; i++) {
        var a = (i / ring[1]) * Math.PI * 2 + rand() * .5;
        var rr = ring[0] + (rand() - .5) * 14;
        var tp = set[Math.floor(rand() * set.length)];
        var size = tp.t === 'pep' ? 17 + rand() * 4 : 10 + rand() * 5;
        parts.push(topping(tp.t, (cx + Math.cos(a) * rr).toFixed(1), (cy + Math.sin(a) * rr).toFixed(1), size.toFixed(1), tp.c, Math.round(rand() * 360)));
      }
    });

    // Slice cuts
    var slices = o.slices || 8, cuts = '';
    for (var s = 0; s < slices; s++) {
      var ang = (s / slices) * Math.PI * 2;
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

  function rider() {
    return '<svg viewBox="0 0 220 150" aria-hidden="true" focusable="false">' +
      // speed lines
      '<g class="speed" stroke="#FFC72C" stroke-width="5" stroke-linecap="round">' +
        '<line x1="0" y1="70" x2="32" y2="70"/><line x1="8" y1="92" x2="46" y2="92"/><line x1="2" y1="114" x2="28" y2="114"/></g>' +
      // pizza box stack
      '<g transform="translate(40 18)">' +
        '<rect x="0" y="48" width="66" height="16" rx="3" fill="#FFFFFF" stroke="#121212" stroke-width="3"/>' +
        '<rect x="4" y="30" width="66" height="16" rx="3" fill="#FFC72C" stroke="#121212" stroke-width="3"/>' +
        '<rect x="-2" y="12" width="66" height="16" rx="3" fill="#E50914" stroke="#121212" stroke-width="3"/>' +
        '<rect x="6" y="-6" width="66" height="16" rx="3" fill="#FFFFFF" stroke="#121212" stroke-width="3"/>' +
        '<text x="35" y="25" font-family="Lilita One, sans-serif" font-size="11" fill="#fff" text-anchor="middle">OMC!</text>' +
        '<text x="37" y="43" font-family="Lilita One, sans-serif" font-size="10" fill="#121212" text-anchor="middle">22"</text>' +
      '</g>' +
      // scooter body
      '<path d="M44 112 L 120 112 C 130 92 150 84 168 86 L 178 64 L 186 64 L 178 92 C 190 96 196 106 196 116 L 44 120 Z" fill="#E50914" stroke="#121212" stroke-width="3" stroke-linejoin="round"/>' +
      '<rect x="40" y="84" width="72" height="16" rx="5" fill="#121212"/>' +
      '<path d="M176 62 L 192 58" stroke="#121212" stroke-width="5" stroke-linecap="round"/>' +
      '<circle cx="194" cy="74" r="5" fill="#FFF7B0" stroke="#121212" stroke-width="2"/>' +
      // rider
      '<path d="M120 86 C 118 64 128 48 146 46 C 160 46 168 58 166 70 L 156 88 Z" fill="#FFC72C" stroke="#121212" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M150 66 L 178 64" stroke="#FFC72C" stroke-width="8" stroke-linecap="round"/>' +
      '<path d="M150 66 L 178 64" stroke="#121212" stroke-width="2" stroke-linecap="round" opacity=".4"/>' +
      '<circle cx="148" cy="30" r="17" fill="#E50914" stroke="#121212" stroke-width="3"/>' +
      '<path d="M150 22 A 12 12 0 0 1 164 32 L 150 34 Z" fill="#8FD3FF" stroke="#121212" stroke-width="2"/>' +
      '<path d="M132 26 L 160 18" stroke="#fff" stroke-width="3" stroke-linecap="round"/>' +
      // wheels
      '<g class="wheel" style="transform-origin:62px 124px"><circle cx="62" cy="124" r="20" fill="#121212"/><circle cx="62" cy="124" r="9" fill="#ddd"/><path d="M62 106 V142 M44 124 H80" stroke="#888" stroke-width="2"/></g>' +
      '<g class="wheel" style="transform-origin:176px 124px"><circle cx="176" cy="124" r="20" fill="#121212"/><circle cx="176" cy="124" r="9" fill="#ddd"/><path d="M176 106 V142 M158 124 H194" stroke="#888" stroke-width="2"/></g>' +
    '</svg>';
  }

  // Small floating toppings for the hero
  var FLOATERS = [
    '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="#C8202A"/><circle cx="14" cy="14" r="3" fill="#ffffff44"/><circle cx="25" cy="24" r="2.5" fill="#00000033"/></svg>',
    '<svg viewBox="0 0 40 40"><path d="M20 3 C33 10 33 28 20 37 C7 28 7 10 20 3z" fill="#2E8B3D"/><path d="M20 6 V34" stroke="#1d5c27" stroke-width="2"/></svg>',
    '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="12" fill="none" stroke="#1C1C1C" stroke-width="7"/></svg>',
    '<svg viewBox="0 0 40 40"><path d="M6 22 A14 12 0 0 1 34 22z" fill="#EADCC8" stroke="#a89880" stroke-width="1.5"/><rect x="16" y="22" width="8" height="12" rx="2" fill="#EADCC8" stroke="#a89880" stroke-width="1.5"/></svg>',
    '<svg viewBox="0 0 40 40"><path d="M12 8 C 26 6 34 18 30 30 C 26 36 18 36 14 32 C 22 28 24 18 12 8z" fill="#2CA02C"/><path d="M12 8 L8 4" stroke="#1d5c27" stroke-width="3" stroke-linecap="round"/></svg>',
    '<svg viewBox="0 0 40 40"><path d="M4 30 L 20 4 L 36 30 Z" fill="#FFC72C" stroke="#D98B32" stroke-width="2" stroke-linejoin="round"/><circle cx="20" cy="20" r="3" fill="#C8202A"/><circle cx="14" cy="26" r="2.5" fill="#C8202A"/><circle cx="26" cy="26" r="2.5" fill="#C8202A"/></svg>'
  ];

  // Food icons for non-pizza menu cards
  var ICONS = {
    chicken: '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M58 18 C 82 16 92 40 80 58 C 70 72 52 70 46 66 L 30 82 C 32 90 22 96 17 88 C 9 90 6 80 14 77 C 8 70 18 62 24 68 L 40 52 C 34 44 36 20 58 18z" fill="#D98B32" stroke="#8a4b12" stroke-width="3"/><path d="M52 28 C 66 26 76 36 72 48" stroke="#F2B35B" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="60" cy="44" r="3" fill="#8a4b12"/><circle cx="68" cy="34" r="2.5" fill="#8a4b12"/></svg>',
    momo: '<svg viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="50" cy="78" rx="40" ry="8" fill="#00000022"/><path d="M14 70 C 14 40 34 26 50 26 C 66 26 86 40 86 70 Z" fill="#FFF6E5" stroke="#d8c4a0" stroke-width="3"/><path d="M50 26 C 46 36 40 42 30 46 M50 26 C 54 36 60 42 70 46 M50 26 L 50 44" stroke="#d8c4a0" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="50" cy="24" r="5" fill="#FFF6E5" stroke="#d8c4a0" stroke-width="3"/></svg>',
    fries: '<svg viewBox="0 0 100 100" aria-hidden="true"><g fill="#FFD84D" stroke="#D98B32" stroke-width="2"><rect x="28" y="14" width="8" height="46" rx="2" transform="rotate(-10 32 37)"/><rect x="40" y="8" width="8" height="50" rx="2"/><rect x="52" y="10" width="8" height="48" rx="2" transform="rotate(6 56 34)"/><rect x="64" y="16" width="8" height="44" rx="2" transform="rotate(14 68 38)"/></g><path d="M22 40 L 78 40 L 70 92 L 30 92 Z" fill="#E50914" stroke="#121212" stroke-width="3" stroke-linejoin="round"/><path d="M38 58 Q 50 68 62 58" stroke="#FFC72C" stroke-width="5" fill="none" stroke-linecap="round"/></svg>',
    drink: '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M58 6 L 54 30" stroke="#121212" stroke-width="5" stroke-linecap="round"/><path d="M26 28 L 74 28 L 66 94 L 34 94 Z" fill="#E50914" stroke="#121212" stroke-width="3" stroke-linejoin="round"/><rect x="22" y="22" width="56" height="10" rx="4" fill="#fff" stroke="#121212" stroke-width="3"/><path d="M32 52 L 68 52 L 66 70 L 34 70 Z" fill="#fff"/><text x="50" y="66" font-family="Lilita One, sans-serif" font-size="12" text-anchor="middle" fill="#E50914">OMC</text></svg>'
  };

  function iconFor(item) {
    if (item.isPizza) return pizza({ diet: item.diet, seed: hashStr(item.name), slices: 6, id: 'i' + item.id });
    var n = item.name.toLowerCase();
    if (/momo/.test(n)) return ICONS.momo;
    if (/fries|combo/.test(n)) return ICONS.fries;
    if (/drink|coke|juice|soda/.test(n)) return ICONS.drink;
    return ICONS.chicken;
  }

  function hashStr(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) + 1; }

  OMC.art = { pizza: pizza, rider: rider, FLOATERS: FLOATERS, iconFor: iconFor };
})(window.OMC = window.OMC || {});
