/* ==========================================================================
   Chicky's brain — intent scoring by keywords over an in-memory knowledge
   base. Answers read the LIVE menu & settings. Replies are HTML strings
   built only from escaped values.
   ========================================================================== */
import { deliveryRange, esc, fmt12 } from '../shared/format.js';
import { dietMarkHtml, iconHtml } from '../shared/Icon.jsx';
import { outletList, outletTitle, telHref, mapHref } from '../shared/outlets.js';

export function makeBot(site) {
  const money = (n) => esc(site.money(n));
  const S = () => site.settings;
  function hoursText() { return fmt12(S().hoursOpen) + ' – ' + fmt12(S().hoursClose); }
  function openText() { return site.isOpen ? 'We\'re <b>open right now</b>!' : 'We\'re <b>closed right now</b> — see you at ' + fmt12(S().hoursOpen) + '.'; }

  function itemsBy(fn, limit) {
    return site.menu.filter(function (m) { return m.available && fn(m); }).slice(0, limit || 50);
  }
  function list(items) {
    return '<ul class="bot-list">' + items.map(function (i) {
      return '<li>' + dietMarkHtml(i.diet) + ' ' + esc(i.name) + ' <span>from ' + money(Math.min.apply(null, i.prices.map(function (p) { return +p.price; }))) + '</span></li>';
    }).join('') + '</ul>';
  }
  function norm(s) { return String(s).toLowerCase().replace(/[^a-z0-9"\s]/g, ' ').replace(/\s+/g, ' ').trim(); }

  // Best item whose full name appears in the message (longest name wins).
  function findItem(msg) {
    let n = ' ' + norm(msg) + ' ';
    let hits = site.menu.filter(function (m) {
      let name = norm(m.name.replace(/\(.*?\)/g, ''));
      return name.length > 2 && n.indexOf(' ' + name + ' ') !== -1;
    });
    hits.sort(function (a, b) { return b.name.length - a.name.length; });
    return hits[0];
  }

  function sizeFor(n) {
    if (n <= 2) return { txt: 'a <b>12" Small</b>', key: 'S' };
    if (n <= 3) return { txt: 'a <b>15" Medium</b>', key: 'M' };
    if (n <= 5) return { txt: 'an <b>18" Large</b>', key: 'L' };
    if (n <= 8) return { txt: 'a <b>22" XL</b> ', key: 'XL' };
    let k = Math.ceil(n / 7);
    return { txt: '<b>' + k + '× 22" XL</b> pizzas (about 7 people each) ', key: 'XL' };
  }

  let INTENTS = [
    { id: 'greet', words: ['hi', 'hello', 'hey', 'namaste', 'yo', 'hola', 'good morning', 'good evening', 'sup'],
      reply: function () {
        return { html: 'Namaste! I\'m <b>Chicky</b>, your Ohh My Chicken Pizza Hub helper. ' + openText() + '<br>Ask me about sizes, veg options, delivery or today\'s deal.' };
      } },
    { id: 'hours', words: ['hour', 'hours', 'open', 'close', 'closing', 'opening', 'timing', 'time', 'when'],
      reply: function () { return { html: 'We\'re open <b>every day, ' + hoursText() + '</b>.<br>' + openText() }; } },
    { id: 'size', words: ['size', 'sizes', 'people', 'person', 'persons', 'party', 'group', 'family', 'big', 'biggest', 'inch', 'xl', 'large', 'medium', 'small', 'recommend', 'suggest', 'how many', 'friends', 'guests', 'feed'],
      reply: function (msg) {
        let num = msg.match(/(\d+)\s*(people|persons?|pax|guests?|friends|of us)?/i);
        let head = '';
        if (num && +num[1] > 0 && +num[1] < 200) {
          let rec = sizeFor(+num[1]);
          head = 'For <b>' + num[1] + ' people</b>, I\'d go with ' + rec.txt + '.<br><br>';
        } else if (/party|group|family|friends|guests|biggest/i.test(msg)) {
          head = 'For parties & groups, the <b>22" XL Giant</b> is the hero — it\'s 3.4× a 12" and feeds 6–8 people! <br><br>';
        }
        return { html: head + 'Our sizes:<ul class="bot-list"><li><b>12" S</b> <span>1–2 people</span></li><li><b>15" M</b> <span>2–3 people</span></li><li><b>18" L</b> <span>4–5 people</span></li><li><b>22" XL</b> <span>6–8 people</span></li></ul>',
          actions: [{ label: 'See pizzas', act: 'cat:nonveg' }] };
      } },
    { id: 'veg', words: ['veg', 'vegetarian', 'vegan', 'paneer', 'no meat', 'meatless', 'veggie', 'plant'],
      reply: function () {
        let v = itemsBy(function (m) { return m.diet === 'veg'; });
        return { html: 'Yes! We have <b>' + v.length + ' vegetarian options</b>, including veg pizzas and veg MoMo:' + list(v.slice(0, 8)) + (v.length > 8 ? '<small>…and ' + (v.length - 8) + ' more.</small>' : ''),
          actions: [{ label: 'Show all veg', act: 'diet:veg' }] };
      } },
    { id: 'chicken', words: ['chicken', 'wings', 'fried chicken', 'crispy', 'drumstick'],
      reply: function () {
        let sp = itemsBy(function (m) { return m.category === 'special'; });
        let pz = itemsBy(function (m) { return m.category === 'nonveg' && m.diet === 'chicken'; });
        return { html: 'Chicken is literally in our name! Our <b>specials</b>:' + list(sp) + 'Plus <b>' + pz.length + ' chicken pizzas</b> like ' + pz.slice(0, 3).map(function (p) { return esc(p.name); }).join(', ') + '.',
          actions: [{ label: 'Chicken specials', act: 'cat:special' }, { label: 'Chicken pizzas', act: 'cat:nonveg' }] };
      } },
    { id: 'buff', words: ['buff', 'buffalo'],
      reply: function () {
        return { html: 'Buff options:' + list(itemsBy(function (m) { return m.diet === 'buff'; })), actions: [{ label: 'Show buff', act: 'diet:buff' }] };
      } },
    { id: 'pork', words: ['pork', 'bacon', 'ham', 'pig'],
      reply: function () {
        return { html: 'Pork options:' + list(itemsBy(function (m) { return m.diet === 'pork'; })), actions: [{ label: 'Show pork', act: 'diet:pork' }] };
      } },
    { id: 'momo', words: ['momo', 'momos', 'dumpling', 'dumplings', 'steam', 'fried momo'],
      reply: function () {
        return { html: 'MoMo comes <b>Steam or Fried</b> in Veg, Buff, Chicken & Pork:' + list(itemsBy(function (m) { return /momo/i.test(m.name); })),
          actions: [{ label: 'MoMo & extras', act: 'cat:momo' }] };
      } },
    { id: 'spicy', words: ['spicy', 'hot', 'chilli', 'chili', 'jalapeno', 'fire', 'heat'],
      reply: function () {
        let h = itemsBy(function (m) { return /hot|jalapeno|smoky|pepperoni/i.test(m.name); });
        return { html: 'Like it hot? Try these:' + list(h) };
      } },
    { id: 'delivery', words: ['deliver', 'delivery', 'how long', 'fee', 'charge', 'area', 'shipping', 'rider', 'eta', 'fast'],
      reply: function () {
        let s = S();
        return { html: 'We deliver hot in about <b>' + s.deliveryMins + ' minutes</b>.<br>Delivery fee: <b>' + esc(deliveryRange(s)) + '</b>, the outlet confirms it.<br>Call <a href="tel:' + esc(s.phone.replace(/\s/g, '')) + '">' + esc(s.phone) + '</a> to check if we reach your area.' };
      } },
    { id: 'order', words: ['order', 'buy', 'checkout', 'cart', 'purchase', 'book', 'place'],
      reply: function () {
        return { html: 'Ordering is easy:<ol class="bot-list"><li>Open the <b>Menu</b> & tap <b>Add</b></li><li>Open your cart & add a promo code</li><li>Tap <b>Place order</b> — it opens WhatsApp pre-filled</li></ol>',
          actions: [{ label: 'Open menu', act: 'go:menu' }, { label: 'View cart', act: 'cart' }] };
      } },
    { id: 'promo', words: ['offer', 'offers', 'discount', 'code', 'deal', 'deals', 'promo', 'coupon', 'sale'],
      reply: function () {
        let p = S().promo;
        if (!p.enabled) return { html: 'No promo running right now — but our 22" XL is already the best value per slice.' };
        return { html: esc(p.headline) + '<br>Use code <b class="code-inline">' + esc(p.code) + '</b> at checkout (' + p.percent + '% off one 22" XL pizza).',
          actions: [{ label: 'Apply code', act: 'promo' }] };
      } },
    { id: 'contact', words: ['where', 'address', 'location', 'located', 'phone', 'call', 'contact', 'number', 'whatsapp', 'find', 'outlet', 'outlets', 'branch', 'branches', 'near', 'nearest'],
      reply: function () {
        let s = S(), list = outletList(s);
        let html = (list.length > 1 ? 'We have <b>' + list.length + ' outlets</b>:' : '') + list.map(function (o) {
          return '<span class="bot-line">' + iconHtml('pin') + '<span><b>' + esc(outletTitle(o)) + '</b>' + (o.address && o.address !== outletTitle(o) ? ', ' + esc(o.address) : '') +
            ' · <a href="' + esc(mapHref(o, s)) + '" target="_blank" rel="noopener">Directions</a></span></span>' +
            (o.phones.length ? '<span class="bot-line">' + iconHtml('phone') + '<span>' + o.phones.map(function (p) { return '<a href="' + esc(telHref(p)) + '">' + esc(p) + '</a>'; }).join(' / ') + '</span></span>' : '');
        }).join('');
        return { html: html + '<span class="bot-line">' + iconHtml('clock') + hoursText() + '</span>', actions: [{ label: 'See outlets', act: 'go:find' }] };
      } },
    { id: 'drinks', words: ['drink', 'drinks', 'coke', 'soda', 'beverage', 'coffee', 'tea', 'latte', 'cappuccino', 'americano', 'frappe', 'espresso', 'water'],
      reply: function () {
        let d = itemsBy(function (m) { return m.category === 'drinks'; });
        return { html: 'We have <b>' + d.length + ' drinks</b>: espresso coffees, teas, iced coffees and soft drinks. A few:' + list(d.slice(0, 8)),
          actions: [{ label: 'All drinks', act: 'cat:drinks' }] };
      } },
    { id: 'sides', words: ['fries', 'sides', 'side', 'combo', 'snack', 'extra cheese', 'add-on', 'addon'],
      reply: function () {
        return { html: 'Sides & add-ons:' + list(itemsBy(function (m) { return m.category === 'momo' && !/momo/i.test(m.name); })), actions: [{ label: 'MoMo & fries', act: 'cat:momo' }] };
      } },
    { id: 'thanks', words: ['thanks', 'thank', 'thx', 'dhanyabad', 'great', 'awesome', 'cool', 'nice', 'ok', 'okay'],
      reply: function () { return { html: 'Anytime! Enjoy your meal — and remember: the 22" XL never disappoints.' }; } },
    { id: 'bye', words: ['bye', 'goodbye', 'see you', 'later', 'cya'],
      reply: function () { return { html: 'Bye! Come back hungry.' }; } }
  ];

  function score(intent, msg) {
    let n = ' ' + norm(msg) + ' ';
    return intent.words.reduce(function (s, w) { return s + (n.indexOf(' ' + w + ' ') !== -1 || (w.length > 4 && n.indexOf(w) !== -1) ? (w.indexOf(' ') !== -1 ? 2 : 1) : 0); }, 0);
  }

  function answer(msg) {
    // 1. A specific dish (prices + add buttons)
    let item = findItem(msg);
    let asksPrice = /price|cost|how much|rate|rs|npr/i.test(msg);
    if (item && (asksPrice || norm(msg).split(' ').length <= 5)) {
      if (!item.available) return { topic: 'dish', html: '<b>' + esc(item.name) + '</b> is sold out right now. Can I suggest something similar?' };
      return {
        topic: 'dish',
        html: dietMarkHtml(item.diet) + ' <b>' + esc(item.name) + '</b>' + (item.desc ? '<br><small>' + esc(item.desc) + '</small>' : '') +
              '<ul class="bot-list">' + item.prices.map(function (p) { return '<li>' + esc(p.label) + ' <span>' + money(p.price) + '</span></li>'; }).join('') + '</ul>',
        actions: item.prices.slice(-2).map(function (p) { return { label: 'Add ' + p.label, act: 'add:' + item.id + ':' + p.label }; })
      };
    }
    // 2. Best scoring intent
    let best = null, bestScore = 0;
    INTENTS.forEach(function (it) { let s = score(it, msg); if (s > bestScore) { best = it; bestScore = s; } });
    // Prefer sizing when a headcount is mentioned
    if (/\d+\s*(people|persons?|pax|guests?|friends|of us)/i.test(msg)) best = INTENTS.find(function (i) { return i.id === 'size'; });
    if (best) return { topic: best.id, ...best.reply(msg) };
    // 3. Fallback: try a menu search
    let q = norm(msg);
    let found = site.menu.filter(function (m) { return norm(m.name + ' ' + m.desc).indexOf(q) !== -1; });
    if (q.length > 2 && found.length) return { topic: 'menu search', html: 'Here\'s what I found:' + list(found.slice(0, 6)), actions: [{ label: 'Search menu', act: 'search:' + msg }] };
    // Questions the bot can't answer are the useful ones: keep their start (digits get masked server-side).
    return { topic: 'unanswered: ' + q.slice(0, 60), html: 'Hmm, I\'m just a chicken — I didn\'t catch that. Try asking about <b>hours</b>, <b>sizes</b>, <b>veg options</b>, <b>delivery</b> or our <b>deal</b>. Or call us at ' + esc(S().phone) + '.' };
  }

  return { answer, greet: () => INTENTS[0].reply() };
}
