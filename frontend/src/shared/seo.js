/* ==========================================================================
   SEO — routes, page titles & descriptions, FAQ copy and schema.org data.
   Plain JS shared by the Node server (first page load, sitemap) and the
   React app (head updates on in-app navigation), so both always agree.
   Everything is derived from the live menu & settings: nothing invented.
   ========================================================================== */

const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const OG_IMAGE = { path: '/assets/og-image.png', width: 1200, height: 630 };

const money = (s, n) => s.currency + ' ' + Number(n || 0).toLocaleString('en-IN');
function fmt12(t) {
  const p = String(t).split(':'), h = +p[0], m = p[1] || '00';
  return ((h % 12) || 12) + (m === '00' ? '' : ':' + m) + (h < 12 ? ' AM' : ' PM');
}
const toMin = (t) => { const p = String(t).split(':'); return (+p[0]) * 60 + (+p[1] || 0); };
const city = (s) => s.city || 'Kathmandu';
const sub = (text, s) => String(text || '').replace(/\{city\}/g, city(s));

// Cut at a word boundary so descriptions fit search result snippets (~160 chars).
function clip(text, max = 160) {
  if (text.length <= max) return text;
  return text.slice(0, text.lastIndexOf(' ', max - 1)).replace(/[,;:.\s–—-]+$/, '') + '…';
}

// Whole sentences only: add each one while the text still fits.
function fit(sentences, max = 160) {
  let out = '';
  for (const part of sentences.filter(Boolean)) {
    const next = out ? out + ' ' + part : part;
    if (next.length > max) { if (!out) out = clip(part, max); break; }
    out = next;
  }
  return out;
}

/* ---------- Facts derived from settings ---------- */
export function hoursText(s) { return fmt12(s.hoursOpen) + '–' + fmt12(s.hoursClose); }

// Which meals the opening hours actually cover.
export function meals(s) {
  const o = toMin(s.hoursOpen), c = toMin(s.hoursClose), overnight = c <= o;
  const open = (from, to) => (overnight ? !(from >= c && to <= o) : o <= from && c >= to);
  const out = [];
  if (open(12 * 60, 14 * 60)) out.push('lunch');
  if (open(19 * 60, 21 * 60)) out.push('dinner');
  return out;
}

// "dine in, take away or get it delivered" from the services switched on.
export function servicesText(s) {
  const list = [];
  if (s.dineIn) list.push('dine in');
  if (s.takeaway) list.push('take away');
  list.push('order delivery');
  return list.length === 1 ? list[0] : list.slice(0, -1).join(', ') + ' or ' + list[list.length - 1];
}

function priceRange(menu) {
  const all = menu.filter((m) => m.available).flatMap((m) => m.prices.map((p) => +p.price)).filter((n) => n > 0);
  return all.length ? [Math.min(...all), Math.max(...all)] : null;
}

/* ---------- Routes ---------- */
/**
 * Map a URL path to a page. `canonical` is the one URL search engines
 * should index for it (null = not indexable).
 */
export function resolveRoute(pathname, categories) {
  const p = ('/' + String(pathname || '').replace(/^\/+|\/+$/g, '')).toLowerCase();
  if (p === '/') return { view: 'home', path: p, canonical: '/' };
  if (p === '/sizes' || p === '/find') return { view: 'home', section: p.slice(1), path: p, canonical: '/' };
  if (p === '/menu') return { view: 'menu', path: p, canonical: '/menu' };
  const m = p.match(/^\/menu\/([a-z0-9-]+)$/);
  const cat = m && categories.find((c) => c.slug === m[1]);
  if (cat) return { view: 'menu', cat, path: p, canonical: p };
  return { view: 'notfound', path: p, canonical: null };
}

export const categoryPath = (c) => '/menu/' + c.slug;

/* ---------- Titles & descriptions ---------- */
export function pageMeta(route, boot) {
  const s = boot.settings, name = s.name, menu = boot.menu;
  const mealWords = meals(s);
  const mealPhrase = mealWords.length ? ' for ' + mealWords.join(' or ') : '';
  if (route.view === 'menu' && route.cat) {
    const c = route.cat, items = menu.filter((m) => m.category === c.id && m.available);
    const range = priceRange(items);
    return {
      title: sub(c.seo || c.name, s) + ' | ' + name,
      heading: sub(c.seo || c.name, s),
      description: fit([c.blurb, items.length ? items.length + ' options' + (range ? ' from ' + money(s, range[0]) : '') + '.' : '',
        'Order online for delivery in ' + city(s) + '.']),
      robots: 'index, follow, max-image-preview:large'
    };
  }
  if (route.view === 'menu') {
    const pizzas = priceRange(menu.filter((m) => m.isPizza));
    return {
      title: 'Menu & Prices: Pizza, Fried Chicken & MoMo | ' + name,
      heading: 'The Menu',
      description: fit(['Full menu with prices: ' + menu.filter((m) => m.available).length + ' dishes, including pizzas in 12" to 22" XL' +
        (pizzas ? ' from ' + money(s, pizzas[0]) : '') + ', crispy fried chicken, wings and MoMo.', 'Order online in ' + city(s) + '.']),
      robots: 'index, follow, max-image-preview:large'
    };
  }
  if (route.view === 'notfound') {
    return { title: 'Page not found | ' + name, heading: 'Page not found', description: 'This page does not exist. See the menu of ' + name + ', pizza restaurant in ' + city(s) + '.', robots: 'noindex, follow' };
  }
  return {
    title: name + ' | Pizza Restaurant in ' + city(s),
    heading: 'Pizza restaurant in ' + city(s),
    description: fit(['Giant 22" pizzas, crispy fried chicken & MoMo in ' + city(s) + '.',
      servicesText(s).replace(/^./, (ch) => ch.toUpperCase()) + mealPhrase + '.',
      'Delivery in about ' + s.deliveryMins + ' min.', 'Open daily ' + hoursText(s) + '.']),
    robots: 'index, follow, max-image-preview:large'
  };
}

/* ---------- FAQ (shown on the home page and sent as FAQPage data) ---------- */
export function faqs(boot) {
  const s = boot.settings, menu = boot.menu, name = s.name, m = meals(s);
  const veg = menu.filter((i) => i.available && i.diet === 'veg').length;
  const list = [];
  if (m.length) {
    list.push({
      q: 'Is ' + name + ' open for ' + m.join(' and ') + '?',
      a: 'Yes. We are open every day from ' + hoursText(s) + ', so you can ' + servicesText(s) + ' for ' + m.join(' or ') + '.'
    });
  } else {
    list.push({ q: 'What are your opening hours?', a: 'We are open every day from ' + hoursText(s) + '.' });
  }
  list.push({
    q: 'Do you deliver pizza in ' + city(s) + '?',
    a: 'Yes. Delivery takes about ' + s.deliveryMins + ' minutes. The delivery fee is ' + money(s, s.deliveryFee) +
      (s.freeDeliveryOver ? ', and delivery is free on orders over ' + money(s, s.freeDeliveryOver) : '') + '.'
  });
  list.push({
    q: 'What pizza sizes do you have?',
    a: 'Our pizzas come in 12" Small (1–2 people), 15" Medium (2–3), 18" Large (4–5) and the giant 22" XL, which feeds 6–8 people and is made for parties and family dinners.'
  });
  if (veg) list.push({ q: 'Do you have vegetarian food?', a: 'Yes, ' + veg + ' vegetarian dishes, including veg pizzas and veg MoMo, made on a separate veg prep line.' });
  if (s.dineIn) list.push({ q: 'Can I order from my table?', a: 'Yes. Scan the QR code on your table to open the menu. Your order is sent with your table number.' });
  list.push({
    q: 'How do I order online?',
    a: 'Add dishes from the online menu and tap Place order. Your order opens in WhatsApp, ready to send.' + (s.phone ? ' You can also call us on ' + s.phone + '.' : '')
  });
  return list;
}

/* ---------- schema.org structured data ---------- */
export function jsonLd(route, boot, origin) {
  const s = boot.settings, menu = boot.menu, cats = boot.defaults.CATEGORIES;
  const home = origin + '/', restaurantId = origin + '/#restaurant';
  const range = priceRange(menu);
  const address = { '@type': 'PostalAddress', addressLocality: city(s), addressCountry: s.country || 'NP' };
  if (s.street) address.streetAddress = s.street;
  if (s.region) address.addressRegion = s.region;
  if (s.postalCode) address.postalCode = s.postalCode;

  const restaurant = {
    '@type': 'Restaurant',
    '@id': restaurantId,
    name: s.name,
    url: home,
    description: pageMeta({ view: 'home' }, boot).description,
    image: [origin + OG_IMAGE.path].concat((boot.gallery || []).slice(0, 5).map((g) => origin + g.url)),
    logo: origin + '/assets/icon-512.png',
    address,
    servesCuisine: ['Pizza', 'Fried Chicken', 'MoMo', 'Nepalese', 'Fast Food'],
    openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: WEEK, opens: s.hoursOpen, closes: s.hoursClose }],
    hasMenu: origin + '/menu',
    areaServed: { '@type': 'City', name: city(s) },
    currenciesAccepted: s.currencyCode || 'NPR',
    potentialAction: {
      '@type': 'OrderAction',
      target: { '@type': 'EntryPoint', urlTemplate: origin + '/menu', actionPlatform: ['https://schema.org/DesktopWebPlatform', 'https://schema.org/MobileWebPlatform'] },
      deliveryMethod: ['http://purl.org/goodrelations/v1#DeliveryModeOwnFleet'].concat(s.takeaway ? ['http://purl.org/goodrelations/v1#DeliveryModePickUp'] : [])
    }
  };
  if (s.phone) restaurant.telephone = s.phone.replace(/[^\d+]/g, '');
  if (range) restaurant.priceRange = money(s, range[0]) + ' – ' + money(s, range[1]);
  if (s.lat != null && s.lng != null) restaurant.geo = { '@type': 'GeoCoordinates', latitude: s.lat, longitude: s.lng };
  if (s.mapsUrl) restaurant.hasMap = s.mapsUrl;
  if (s.socialLinks && s.socialLinks.length) restaurant.sameAs = s.socialLinks;

  const graph = [restaurant];

  if (route.view === 'home') {
    graph.push({ '@type': 'WebSite', '@id': origin + '/#website', name: s.name, url: home, publisher: { '@id': restaurantId }, inLanguage: 'en' });
    graph.push({
      '@type': 'FAQPage', '@id': home + '#faq',
      mainEntity: faqs(boot).map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
    });
  }

  if (route.view === 'menu') {
    const shown = route.cat ? cats.filter((c) => c.id === route.cat.id) : cats;
    graph.push({
      '@type': 'Menu',
      '@id': origin + (route.cat ? categoryPath(route.cat) : '/menu') + '#menu',
      name: route.cat ? sub(route.cat.seo, s) : s.name + ' menu',
      url: origin + (route.cat ? categoryPath(route.cat) : '/menu'),
      inLanguage: 'en',
      hasMenuSection: shown.map((c) => ({
        '@type': 'MenuSection',
        name: c.name,
        url: origin + categoryPath(c),
        hasMenuItem: menu.filter((m) => m.category === c.id).map((m) => {
          const item = {
            '@type': 'MenuItem',
            name: m.name,
            offers: m.prices.map((p) => ({
              '@type': 'Offer', name: p.label, price: String(p.price), priceCurrency: s.currencyCode || 'NPR',
              availability: m.available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
            }))
          };
          if (m.desc) item.description = m.desc;
          if (m.image) item.image = origin + m.image.url;
          if (m.diet === 'veg') item.suitableForDiet = 'https://schema.org/VegetarianDiet';
          return item;
        })
      }))
    });
    const crumbs = [{ name: 'Home', url: home }, { name: 'Menu', url: origin + '/menu' }];
    if (route.cat) crumbs.push({ name: sub(route.cat.seo, s), url: origin + categoryPath(route.cat) });
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url }))
    });
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}

// JSON that is safe inside a <script> element.
export const safeJson = (v) => JSON.stringify(v).replace(/[<\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

const attr = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/* ---------- <head> tags (server) ---------- */
export function headHtml(route, boot, origin) {
  const meta = pageMeta(route, boot), s = boot.settings;
  const url = route.canonical != null ? origin + route.canonical : null;
  const tags = [
    '<title>' + attr(meta.title) + '</title>',
    '<meta name="description" content="' + attr(meta.description) + '">',
    '<meta name="robots" content="' + meta.robots + '">',
    url ? '<link rel="canonical" href="' + attr(url) + '">' : '',
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="' + attr(s.name) + '">',
    '<meta property="og:locale" content="en_US">',
    '<meta property="og:title" content="' + attr(meta.title) + '">',
    '<meta property="og:description" content="' + attr(meta.description) + '">',
    url ? '<meta property="og:url" content="' + attr(url) + '">' : '',
    '<meta property="og:image" content="' + attr(origin + OG_IMAGE.path) + '">',
    '<meta property="og:image:width" content="' + OG_IMAGE.width + '">',
    '<meta property="og:image:height" content="' + OG_IMAGE.height + '">',
    '<meta property="og:image:alt" content="' + attr(s.name + ': giant 22 inch pizza') + '">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="' + attr(meta.title) + '">',
    '<meta name="twitter:description" content="' + attr(meta.description) + '">',
    '<meta name="twitter:image" content="' + attr(origin + OG_IMAGE.path) + '">',
    route.view !== 'notfound' ? '<script type="application/ld+json" id="ld-json">' + safeJson(jsonLd(route, boot, origin)) + '</script>' : ''
  ];
  return tags.filter(Boolean).join('\n  ');
}

/* ---------- <head> updates (browser, after in-app navigation) ---------- */
export function applyHead(route, boot) {
  const origin = location.origin, meta = pageMeta(route, boot);
  const url = route.canonical != null ? origin + route.canonical : null;
  document.title = meta.title;
  const set = (sel, make, value) => {
    let el = document.head.querySelector(sel);
    if (value == null) { if (el) el.remove(); return; }
    if (!el) { el = make(); document.head.appendChild(el); }
    if (el.tagName === 'LINK') el.href = value; else el.content = value;
  };
  const metaEl = (k, v) => () => { const m = document.createElement('meta'); m.setAttribute(k, v); return m; };
  set('meta[name="description"]', metaEl('name', 'description'), meta.description);
  set('meta[name="robots"]', metaEl('name', 'robots'), meta.robots);
  set('link[rel="canonical"]', () => { const l = document.createElement('link'); l.rel = 'canonical'; return l; }, url);
  set('meta[property="og:title"]', metaEl('property', 'og:title'), meta.title);
  set('meta[property="og:description"]', metaEl('property', 'og:description'), meta.description);
  set('meta[property="og:url"]', metaEl('property', 'og:url'), url);
  set('meta[name="twitter:title"]', metaEl('name', 'twitter:title'), meta.title);
  set('meta[name="twitter:description"]', metaEl('name', 'twitter:description'), meta.description);
  let ld = document.getElementById('ld-json');
  if (route.view === 'notfound') { if (ld) ld.remove(); return; }
  if (!ld) { ld = document.createElement('script'); ld.type = 'application/ld+json'; ld.id = 'ld-json'; document.head.appendChild(ld); }
  ld.textContent = JSON.stringify(jsonLd(route, boot, origin));
}
