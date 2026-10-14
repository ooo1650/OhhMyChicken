/* ==========================================================================
   Chicky — in-browser support chatbot with an in-memory knowledge base.
   Intent scoring by keywords; answers read the LIVE menu & settings, so
   anything changed in Admin is reflected immediately.
   ========================================================================== */
(function (OMC) {
  'use strict';
  var ui = OMC.ui, $ = ui.$, esc = ui.esc, store = OMC.store;
  var greeted = false;

  function S() { return store.getSettings(); }
  function fmt12(t) {
    var p = String(t).split(':'), h = +p[0], m = p[1] || '00';
    return ((h % 12) || 12) + ':' + m + (h < 12 ? ' AM' : ' PM');
  }
  function hoursText() { return fmt12(S().hoursOpen) + ' – ' + fmt12(S().hoursClose); }
  function openText() { return store.isOpenNow() ? '🟢 We\'re <b>open right now</b>!' : '🔴 We\'re <b>closed right now</b> — see you at ' + fmt12(S().hoursOpen) + '.'; }

  function itemsBy(fn, limit) {
    return store.getMenu().filter(function (m) { return m.available && fn(m); }).slice(0, limit || 50);
  }
  function list(items) {
    return '<ul class="bot-list">' + items.map(function (i) {
      return '<li>' + ui.dietIcon(i.diet) + ' ' + esc(i.name) + ' <span>from ' + store.money(Math.min.apply(null, i.prices.map(function (p) { return +p.price; }))) + '</span></li>';
    }).join('') + '</ul>';
  }
  function norm(s) { return String(s).toLowerCase().replace(/[^a-z0-9"\s]/g, ' ').replace(/\s+/g, ' ').trim(); }

  // Best item whose full name appears in the message (longest name wins).
  function findItem(msg) {
    var n = ' ' + norm(msg) + ' ';
    var hits = store.getMenu().filter(function (m) {
      var name = norm(m.name.replace(/\(.*?\)/g, ''));
      return name.length > 2 && n.indexOf(' ' + name + ' ') !== -1;
    });
    hits.sort(function (a, b) { return b.name.length - a.name.length; });
    return hits[0];
  }

  function sizeFor(n) {
    if (n <= 2) return { txt: 'a <b>12" Small</b>', key: 'S' };
    if (n <= 3) return { txt: 'a <b>15" Medium</b>', key: 'M' };
    if (n <= 5) return { txt: 'an <b>18" Large</b>', key: 'L' };
    if (n <= 8) return { txt: 'a <b>22" XL</b> 🎉', key: 'XL' };
    var k = Math.ceil(n / 7);
    return { txt: '<b>' + k + '× 22" XL</b> pizzas (about 7 people each) 🎉', key: 'XL' };
  }

  var INTENTS = [
    { id: 'greet', words: ['hi', 'hello', 'hey', 'namaste', 'yo', 'hola', 'good morning', 'good evening', 'sup'],
      reply: function () {
        return { html: 'Namaste! 👋 I\'m <b>Chicky</b>, your Ohh My Chicken! helper. ' + openText() + '<br>Ask me about sizes, veg options, delivery or today\'s deal.' };
      } },
    { id: 'hours', words: ['hour', 'hours', 'open', 'close', 'closing', 'opening', 'timing', 'time', 'when'],
      reply: function () { return { html: '🕙 We\'re open <b>every day, ' + hoursText() + '</b>.<br>' + openText() }; } },
    { id: 'size', words: ['size', 'sizes', 'people', 'person', 'persons', 'party', 'group', 'family', 'big', 'biggest', 'inch', 'xl', 'large', 'medium', 'small', 'recommend', 'suggest', 'how many', 'friends', 'guests', 'feed'],
      reply: function (msg) {
        var num = msg.match(/(\d+)\s*(people|persons?|pax|guests?|friends|of us)?/i);
        var head = '';
        if (num && +num[1] > 0 && +num[1] < 200) {
          var rec = sizeFor(+num[1]);
          head = 'For <b>' + num[1] + ' people</b>, I\'d go with ' + rec.txt + '.<br><br>';
        } else if (/party|group|family|friends|guests|biggest/i.test(msg)) {
          head = 'For parties & groups, the <b>22" XL Giant</b> is the hero — it\'s 3.4× a 12" and feeds 6–8 people! 🎉<br><br>';
        }
        return { html: head + '🍕 Our sizes:<ul class="bot-list"><li><b>12" S</b> <span>1–2 people</span></li><li><b>15" M</b> <span>2–3 people</span></li><li><b>18" L</b> <span>4–5 people</span></li><li><b>22" XL</b> <span>6–8 people</span></li></ul>',
          actions: [{ label: 'See pizzas', act: 'cat:nonveg' }] };
      } },
    { id: 'veg', words: ['veg', 'vegetarian', 'vegan', 'paneer', 'no meat', 'meatless', 'veggie', 'plant'],
      reply: function () {
        var v = itemsBy(function (m) { return m.diet === 'veg'; });
        return { html: '🟢 Yes! We have <b>' + v.length + ' vegetarian options</b>, all made in a separate prep line:' + list(v.slice(0, 8)) + (v.length > 8 ? '<small>…and ' + (v.length - 8) + ' more.</small>' : ''),
          actions: [{ label: 'Show all veg', act: 'diet:veg' }] };
      } },
    { id: 'chicken', words: ['chicken', 'wings', 'fried chicken', 'crispy', 'drumstick'],
      reply: function () {
        var sp = itemsBy(function (m) { return m.category === 'special'; });
        var pz = itemsBy(function (m) { return m.category === 'nonveg' && m.diet === 'chicken'; });
        return { html: '🍗 Chicken is literally in our name! Our <b>specials</b>:' + list(sp) + 'Plus <b>' + pz.length + ' chicken pizzas</b> like ' + pz.slice(0, 3).map(function (p) { return esc(p.name); }).join(', ') + '.',
          actions: [{ label: 'Chicken specials', act: 'cat:special' }, { label: 'Chicken pizzas', act: 'cat:nonveg' }] };
      } },
    { id: 'buff', words: ['buff', 'buffalo'],
      reply: function () {
        return { html: '🐃 Buff options:' + list(itemsBy(function (m) { return m.diet === 'buff'; })), actions: [{ label: 'Show buff', act: 'diet:buff' }] };
      } },
    { id: 'pork', words: ['pork', 'bacon', 'ham', 'pig'],
      reply: function () {
        return { html: '🐖 Pork options:' + list(itemsBy(function (m) { return m.diet === 'pork'; })), actions: [{ label: 'Show pork', act: 'diet:pork' }] };
      } },
    { id: 'momo', words: ['momo', 'momos', 'dumpling', 'dumplings', 'steam', 'fried momo'],
      reply: function () {
        return { html: '🥟 MoMo comes <b>Steam or Fried</b> in Veg, Buff, Chicken & Pork:' + list(itemsBy(function (m) { return /momo/i.test(m.name); })),
          actions: [{ label: 'MoMo & extras', act: 'cat:momo' }] };
      } },
    { id: 'spicy', words: ['spicy', 'hot', 'chilli', 'chili', 'jalapeno', 'fire', 'heat'],
      reply: function () {
        var h = itemsBy(function (m) { return /hot|jalapeno|smoky|pepperoni/i.test(m.name); });
        return { html: '🌶️ Like it hot? Try these:' + list(h) };
      } },
    { id: 'delivery', words: ['deliver', 'delivery', 'how long', 'fee', 'charge', 'area', 'shipping', 'rider', 'eta', 'fast'],
      reply: function () {
        var s = S();
        return { html: '🛵 We deliver hot in about <b>' + s.deliveryMins + ' minutes</b>.<br>Delivery fee: <b>' + store.money(s.deliveryFee) + '</b> — <b>FREE</b> on orders over ' + store.money(s.freeDeliveryOver) + '.<br>Call <a href="tel:' + esc(s.phone.replace(/\s/g, '')) + '">' + esc(s.phone) + '</a> to check if we reach your area.' };
      } },
    { id: 'order', words: ['order', 'buy', 'checkout', 'cart', 'purchase', 'book', 'place'],
      reply: function () {
        return { html: '🧾 Ordering is easy:<ol class="bot-list"><li>Open the <b>Menu</b> & tap <b>＋ Add</b></li><li>Open your cart 🛒 & add a promo code</li><li>Tap <b>Place order</b> — it opens WhatsApp pre-filled</li></ol>',
          actions: [{ label: 'Open menu', act: 'go:menu' }, { label: 'View cart', act: 'cart' }] };
      } },
    { id: 'promo', words: ['offer', 'offers', 'discount', 'code', 'deal', 'deals', 'promo', 'coupon', 'sale'],
      reply: function () {
        var p = S().promo;
        if (!p.enabled) return { html: 'No promo running right now — but our 22" XL is already the best value per slice! 😉' };
        return { html: '🎁 ' + esc(p.headline) + '<br>Use code <b class="code-inline">' + esc(p.code) + '</b> at checkout (' + p.percent + '% off one 22" XL pizza).',
          actions: [{ label: 'Apply code', act: 'promo' }] };
      } },
    { id: 'contact', words: ['where', 'address', 'location', 'located', 'phone', 'call', 'contact', 'number', 'whatsapp', 'find'],
      reply: function () {
        var s = S();
        return { html: '📍 ' + esc(s.address) + '<br>📞 <a href="tel:' + esc(s.phone.replace(/\s/g, '')) + '">' + esc(s.phone) + '</a><br>🕙 ' + hoursText() };
      } },
    { id: 'drinks', words: ['drink', 'drinks', 'coke', 'soda', 'beverage', 'fries', 'sides', 'side'],
      reply: function () {
        return { html: '🍟 Sides & drinks:' + list(itemsBy(function (m) { return m.category === 'momo' && !/momo/i.test(m.name); })) };
      } },
    { id: 'thanks', words: ['thanks', 'thank', 'thx', 'dhanyabad', 'great', 'awesome', 'cool', 'nice', 'ok', 'okay'],
      reply: function () { return { html: 'Anytime! 🍗 Enjoy your meal — and remember: the 22" XL never disappoints.' }; } },
    { id: 'bye', words: ['bye', 'goodbye', 'see you', 'later', 'cya'],
      reply: function () { return { html: 'Bye! Come back hungry. 👋🍕' }; } }
  ];

  function score(intent, msg) {
    var n = ' ' + norm(msg) + ' ';
    return intent.words.reduce(function (s, w) { return s + (n.indexOf(' ' + w + ' ') !== -1 || (w.length > 4 && n.indexOf(w) !== -1) ? (w.indexOf(' ') !== -1 ? 2 : 1) : 0); }, 0);
  }

  function answer(msg) {
    // 1. A specific dish (prices + add buttons)
    var item = findItem(msg);
    var asksPrice = /price|cost|how much|rate|rs|npr/i.test(msg);
    if (item && (asksPrice || norm(msg).split(' ').length <= 5)) {
      if (!item.available) return { html: '😢 <b>' + esc(item.name) + '</b> is sold out right now. Can I suggest something similar?' };
      return {
        html: ui.dietIcon(item.diet) + ' <b>' + esc(item.name) + '</b>' + (item.desc ? '<br><small>' + esc(item.desc) + '</small>' : '') +
              '<ul class="bot-list">' + item.prices.map(function (p) { return '<li>' + esc(p.label) + ' <span>' + store.money(p.price) + '</span></li>'; }).join('') + '</ul>',
        actions: item.prices.slice(-2).map(function (p) { return { label: '＋ ' + p.label, act: 'add:' + item.id + ':' + p.label }; })
      };
    }
    // 2. Best scoring intent
    var best = null, bestScore = 0;
    INTENTS.forEach(function (it) { var s = score(it, msg); if (s > bestScore) { best = it; bestScore = s; } });
    // Prefer sizing when a headcount is mentioned
    if (/\d+\s*(people|persons?|pax|guests?|friends|of us)/i.test(msg)) best = INTENTS.find(function (i) { return i.id === 'size'; });
    if (best) return best.reply(msg);
    // 3. Fallback: try a menu search
    var q = norm(msg);
    var found = store.getMenu().filter(function (m) { return norm(m.name + ' ' + m.desc).indexOf(q) !== -1; });
    if (q.length > 2 && found.length) return { html: 'Here\'s what I found:' + list(found.slice(0, 6)), actions: [{ label: 'Search menu', act: 'search:' + msg }] };
    return { html: 'Hmm, I\'m just a chicken 🐔 — I didn\'t catch that. Try asking about <b>hours</b>, <b>sizes</b>, <b>veg options</b>, <b>delivery</b> or our <b>deal</b>. Or call us at ' + esc(S().phone) + '.' };
  }

  /* ---------- UI ---------- */
  var QUICK = ['🕙 Hours', '🍕 Size for 8 people', '🟢 Veg options', '🥟 MoMo', '🛵 Delivery', '🎁 Deals'];

  function push(who, html, actions) {
    var log = $('#chatLog');
    var div = document.createElement('div');
    div.className = 'msg msg-' + who;
    div.innerHTML = '<div class="bubble">' + html + (actions && actions.length
      ? '<div class="bot-actions">' + actions.map(function (a) { return '<button type="button" data-act="' + esc(a.act) + '">' + esc(a.label) + '</button>'; }).join('') + '</div>' : '') + '</div>';
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  function botSay(res) {
    var log = $('#chatLog');
    var typing = document.createElement('div');
    typing.className = 'msg msg-bot typing';
    typing.innerHTML = '<div class="bubble"><i></i><i></i><i></i></div>';
    log.appendChild(typing); log.scrollTop = log.scrollHeight;
    setTimeout(function () { typing.remove(); push('bot', res.html, res.actions); }, ui.reducedMotion ? 0 : 450 + Math.random() * 350);
  }

  function send(text) {
    text = String(text).trim();
    if (!text) return;
    push('user', esc(text));
    botSay(answer(text.replace(/^[^\w\d]+\s*/, '')));
  }

  function act(a) {
    var p = a.split(':');
    switch (p[0]) {
      case 'go': location.hash = '#/' + p[1]; break;
      case 'cat': location.hash = '#/menu'; OMC.menu.setCategory(p[1]); break;
      case 'diet': location.hash = '#/menu'; OMC.menu.setCategory('all'); var b = document.querySelector('[data-diet="' + p[1] + '"]'); if (b) b.click(); break;
      case 'search': location.hash = '#/menu'; OMC.menu.setCategory('all'); OMC.menu.setQuery(p.slice(1).join(':')); break;
      case 'cart': toggle(false); OMC.cart.open(); break;
      case 'promo': OMC.cart.applyCode(S().promo.code); toggle(false); OMC.cart.open(); break;
      case 'add':
        store.addToCart(p[1], p.slice(2).join(':'), 1);
        var it = store.getItem(p[1]);
        push('bot', '✅ Added <b>' + esc(it ? it.name : 'item') + ' (' + esc(p.slice(2).join(':')) + ')</b> to your cart!', [{ label: 'View cart', act: 'cart' }]);
        break;
    }
  }

  function toggle(force) {
    var panel = $('#chatPanel'), fab = $('#chatFab');
    var show = typeof force === 'boolean' ? force : panel.hidden;
    fab.setAttribute('aria-expanded', String(show));
    fab.classList.toggle('is-open', show);
    if (show) {
      panel.hidden = false;
      requestAnimationFrame(function () { panel.classList.add('is-open'); });
      fab.querySelector('.chat-ping').hidden = true;
      if (!greeted) { greeted = true; botSay(INTENTS[0].reply()); }
      setTimeout(function () { $('#chatInput').focus(); }, 50);
    } else {
      panel.classList.remove('is-open');
      setTimeout(function () { panel.hidden = true; }, 220);
    }
  }

  OMC.chat = {
    init: function () {
      $('#chatQuick').innerHTML = QUICK.map(function (q) { return '<button type="button">' + q + '</button>'; }).join('');
      $('#chatQuick').addEventListener('click', function (e) { if (e.target.tagName === 'BUTTON') send(e.target.textContent); });
      $('#chatFab').addEventListener('click', function () { toggle(); });
      $('#chatClose').addEventListener('click', function () { toggle(false); $('#chatFab').focus(); });
      $('#chatForm').addEventListener('submit', function (e) { e.preventDefault(); var i = $('#chatInput'); send(i.value); i.value = ''; });
      $('#chatLog').addEventListener('click', function (e) { var b = e.target.closest('[data-act]'); if (b) act(b.dataset.act); });
      $('#chatPanel').addEventListener('keydown', function (e) { if (e.key === 'Escape') { toggle(false); $('#chatFab').focus(); } });
      document.addEventListener('click', function (e) { if (e.target.closest('[data-open-chat]')) toggle(true); });
      var st = function () { $('#chatStatus').textContent = (store.isOpenNow() ? 'Restaurant open' : 'Restaurant closed') + ' · bot replies instantly'; };
      st(); store.on('settings', st);
    },
    answer: answer, // exposed for testing
    toggle: toggle
  };
})(window.OMC = window.OMC || {});
