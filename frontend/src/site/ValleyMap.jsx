/* A hand-drawn map of the Kathmandu valley with a numbered pin per outlet.
   Everything is placed from real coordinates (roughly: it is an illustration,
   not a survey), so pins for new outlets land in the right neighbourhood.
   Outlets just outside the frame are held at its edge; far-away ones are left
   to the list. Name labels move to avoid each other and the frame.
   Loaded on demand: Find us only fetches this module when the map is opened. */
import { VALLEY, onMap } from '../shared/outlets.js';

// Frame in degrees. 600×500 keeps the km scale square at this latitude.
const BOX = VALLEY, W = 600, H = 500;
const at = (lat, lng) => [(lng - BOX.w) / (BOX.e - BOX.w) * W, (BOX.n - lat) / (BOX.n - BOX.s) * H];

// Smooth path through [lat, lng] points (Catmull-Rom as cubic Béziers).
function smooth(pts, closed) {
  const p = pts.map(([la, ln]) => at(la, ln));
  const n = p.length, get = (i) => p[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  let d = 'M' + p[0][0].toFixed(1) + ' ' + p[0][1].toFixed(1);
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = get(i - 1), b = get(i), c = get(i + 1), e = get(i + 2);
    d += ' C' + (b[0] + (c[0] - a[0]) / 6).toFixed(1) + ' ' + (b[1] + (c[1] - a[1]) / 6).toFixed(1) + ' ' +
      (c[0] - (e[0] - b[0]) / 6).toFixed(1) + ' ' + (c[1] - (e[1] - b[1]) / 6).toFixed(1) + ' ' + c[0].toFixed(1) + ' ' + c[1].toFixed(1);
  }
  return d + (closed ? 'z' : '');
}

const RING = [[27.6934, 85.2814], [27.7120, 85.2860], [27.7347, 85.3045], [27.7393, 85.3303], [27.7310, 85.3430], [27.7173, 85.3462],
  [27.6980, 85.3510], [27.6789, 85.3497], [27.6650, 85.3400], [27.6587, 85.3246], [27.6650, 85.3060], [27.6840, 85.2970]];
const ROADS = [
  [[27.6789, 85.3497], [27.6830, 85.3700], [27.6810, 85.3880], [27.6760, 85.4100], [27.6740, 85.4300], [27.6700, 85.4600]], // Araniko Highway
  [[27.6934, 85.2814], [27.6960, 85.2650], [27.7000, 85.2450]],                                                           // Prithvi Highway
  [[27.7393, 85.3303], [27.7550, 85.3400], [27.7700, 85.3600]],                                                           // to Budhanilkantha
  [[27.7173, 85.3462], [27.7215, 85.3620], [27.7300, 85.3800], [27.7350, 85.4000]],                                       // Boudha, Jorpati
  [[27.7347, 85.3045], [27.7550, 85.2980], [27.7750, 85.2900]],                                                           // Balaju north
  [[27.6587, 85.3246], [27.6420, 85.3270], [27.6250, 85.3300]],                                                           // Satdobato south
  [[27.7000, 85.3150], [27.7050, 85.3240], [27.7120, 85.3330], [27.7173, 85.3462]],                                       // through the centre
  [[27.6840, 85.2970], [27.6800, 85.3150], [27.6727, 85.3253], [27.6650, 85.3400]]                                        // Jawalakhel – Patan
];
const RIVERS = [
  [[27.7800, 85.4000], [27.7500, 85.3750], [27.7250, 85.3560], [27.7105, 85.3488], [27.6950, 85.3350], [27.6900, 85.3150], [27.6950, 85.3050], [27.6800, 85.2950], [27.6600, 85.2880], [27.6250, 85.2850]], // Bagmati
  [[27.7800, 85.2950], [27.7500, 85.2990], [27.7200, 85.3020], [27.6950, 85.3050]],  // Bishnumati
  [[27.7800, 85.4300], [27.7400, 85.4050], [27.7050, 85.3850], [27.6900, 85.3500], [27.6850, 85.3350]]  // Manohara
];
const PLACES = [['Thamel', 27.7154, 85.3123], ['Baneshwor', 27.6915, 85.3420], ['Koteshwor', 27.6750, 85.3530], ['Jawalakhel', 27.6730, 85.3120],
  ['Kalanki', 27.6934, 85.2780], ['Chabahil', 27.7190, 85.3500], ['Thimi', 27.6810, 85.3880], ['Satdobato', 27.6550, 85.3270],
  ['Balaju', 27.7330, 85.2980], ['Budhanilkantha', 27.7720, 85.3620], ['Sanepa', 27.6850, 85.3030]];
const TOWNS = [['KATHMANDU', 27.7060, 85.3200], ['LALITPUR', 27.6600, 85.3150], ['BHAKTAPUR', 27.6600, 85.4300], ['KIRTIPUR', 27.6700, 85.2740]];
// Landmark symbols, drawn centred on 0,0.
const STUPA = '<path d="M-9 4h18l-3 -5h-12z" class="lm-base"/><path d="M-6 -1a6 6 0 0 1 12 0z" class="lm-dome"/><path d="M-2 -7h4v-6l-2 -3l-2 3z" class="lm-spire"/>';
const TEMPLE = '<path d="M-8 4h16v-3h-16z" class="lm-base"/><path d="M-9 1l9 -5l9 5z" class="lm-roof"/><path d="M-6 -4l6 -4l6 4z" class="lm-roof"/><path d="M0 -8v-4" class="lm-line"/>';
const PLANE = '<path d="M0 -10 L2 -3 L10 1 L10 3 L2 1 L1.5 7 L4 9 L4 10.5 L0 9.5 L-4 10.5 L-4 9 L-1.5 7 L-2 1 L-10 3 L-10 1 L-2 -3z" class="lm-plane"/>';
const LANDMARKS = [['Swayambhu', 27.7149, 85.2903, STUPA], ['Boudha', 27.7215, 85.3620, STUPA], ['Pashupati', 27.7105, 85.3488, TEMPLE],
  ['Patan Durbar', 27.6727, 85.3253, TEMPLE], ['Bhaktapur Durbar', 27.6722, 85.4278, TEMPLE], ['Airport', 27.6966, 85.3591, PLANE]];
const TREES = [[27.778, 85.285], [27.781, 85.318], [27.779, 85.395], [27.770, 85.430], [27.632, 85.300], [27.627, 85.345], [27.632, 85.400],
  [27.700, 85.250], [27.745, 85.252], [27.742, 85.458], [27.690, 85.460], [27.645, 85.255]]; // on the forested hills

// Static drawing, built once.
const BASE =
  '<path class="v-hills" d="M30 110 Q60 30 170 40 Q230 0 310 30 Q390 0 450 44 Q570 40 578 150 Q614 250 566 330 Q596 440 480 458 Q400 504 300 476 Q200 506 120 462 Q20 446 30 340 Q-10 240 30 110z"/>' +
  '<path class="v-floor" d="M64 140 Q86 74 180 82 Q240 46 310 70 Q390 44 444 88 Q536 90 540 170 Q568 250 528 322 Q550 408 462 422 Q390 460 300 436 Q210 464 144 426 Q56 410 68 330 Q32 240 64 140z"/>' +
  TREES.map(([la, ln]) => { const [x, y] = at(la, ln); return '<path class="v-tree" d="M' + x.toFixed(1) + ' ' + (y - 9).toFixed(1) + 'l7 12h-14z"/>'; }).join('') +
  RIVERS.map((r) => '<path class="v-river" d="' + smooth(r) + '"/>').join('') +
  ROADS.map((r) => '<path class="v-road" d="' + smooth(r) + '"/>').join('') +
  '<path class="v-ring" d="' + smooth(RING, true) + '"/>' +
  (() => { const [x, y] = at(27.6966, 85.3591); return '<path class="v-runway" d="M' + (x - 26).toFixed(1) + ' ' + (y + 10).toFixed(1) + 'l52 -20"/>'; })() +
  LANDMARKS.map(([n, la, ln, g]) => { const [x, y] = at(la, ln); return '<g class="v-lm" transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')">' + g + '<text y="17" text-anchor="middle">' + n + '</text></g>'; }).join('') +
  PLACES.map(([n, la, ln]) => { const [x, y] = at(la, ln); return '<text class="v-place" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" text-anchor="middle">' + n + '</text>'; }).join('') +
  TOWNS.map(([n, la, ln]) => { const [x, y] = at(la, ln); return '<text class="v-town" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" text-anchor="middle">' + n + '</text>'; }).join('') +
  '<g class="v-compass" transform="translate(556 64)"><circle r="18"/><path d="M0 -12 L5 4 L0 1 L-5 4z"/><text y="-22" text-anchor="middle">N</text></g>' +
  '<g class="v-scale" transform="translate(28 478)"><path d="M0 0h' + (W / ((BOX.e - BOX.w) * 98.6) * 2).toFixed(1) + '"/><text y="-6">2 km</text></g>';

// Pin positions (held inside the frame) and label boxes that avoid each other.
function layout(outlets) {
  const pins = outlets.map((o, i) => ({ o, i })).filter(({ o }) => onMap(o)).map((p) => {
    const [x, y] = at(p.o.lat, p.o.lng);
    return { ...p, x: Math.min(W - 24, Math.max(24, x)), y: Math.min(H - 10, Math.max(44, y)) };
  });
  const boxes = pins.map((p) => ({ x: p.x - 18, y: p.y - 52, w: 36, h: 52 })); // pin heads
  const hit = (a) => a.x < 4 || a.y < 4 || a.x + a.w > W - 4 || a.y + a.h > H - 4 ||
    boxes.some((b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y);
  pins.forEach((p) => {
    const w = Math.round(p.o.name.length * 8.4 + 16);
    const tries = [[20, -49], [-20 - w, -49], [20, -22], [-20 - w, -22], [-w / 2, 6], [-w / 2, -82]];
    const pick = tries.map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy, w, h: 22 })).find((b) => !hit(b)) || { x: p.x + 20, y: p.y - 49, w, h: 22 };
    boxes.push(pick);
    p.label = pick;
  });
  return pins;
}

// Moves the map in on the chosen outlet, just enough to keep the others in reach.
const ZOOM = 1.2;
function focusOn(pin) {
  if (!pin) return 'none';
  const hold = (v, size) => Math.min(0, Math.max(size - size * ZOOM, v));
  return 'translate(' + hold(W / 2 - pin.x * ZOOM, W).toFixed(1) + 'px, ' + hold(H / 2 - pin.y * ZOOM, H).toFixed(1) + 'px) scale(' + ZOOM + ')';
}

export default function ValleyMap({ outlets, sel, onPick }) {
  const pins = layout(outlets);
  return (
    <svg className="valley" viewBox={'0 0 ' + W + ' ' + H} role="img" aria-label="Map of our outlets in the Kathmandu valley">
      <g className="v-focus" style={{ transform: focusOn(pins.find((p) => p.o.id === sel)) }}>
      <g dangerouslySetInnerHTML={{ __html: BASE }} />
      {pins.map(({ o, i, x, y, label }) => {
        const on = o.id === sel;
        return (
          <g key={o.id || i} className={'v-pin' + (on ? ' on' : '')} role="button" tabIndex={0} aria-label={'Show ' + o.name} aria-pressed={on}
            onClick={() => onPick(o.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(o.id); } }}>
            <g className="v-pin-label">
              <rect x={label.x} y={label.y} width={label.w} height={label.h} rx="6" />
              <text x={label.x + 8} y={label.y + 15}>{o.name}</text>
            </g>
            <g transform={'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')'}>
              <ellipse className="v-pin-shadow" cx="0" cy="2" rx="9" ry="3.5" />
              <g className="v-pin-body">
                <path d="M0 0 C -6 -12 -17 -20 -17 -33 A 17 17 0 0 1 17 -33 C 17 -20 6 -12 0 0z" />
                <text y="-27" textAnchor="middle">{i + 1}</text>
              </g>
            </g>
          </g>
        );
      })}
      </g>
    </svg>
  );
}
