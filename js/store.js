/* ==========================================================================
   Store — menu, settings, cart & order log with localStorage persistence
   and a tiny pub/sub so every view re-renders when data changes.
   ========================================================================== */
(function (OMC) {
  'use strict';

  var KEYS = {
    menu: 'omc.menu.v1',
    settings: 'omc.settings.v1',
    cart: 'omc.cart.v1',
    orders: 'omc.orders.v1',
    pass: 'omc.pass.v1',
    promoSeen: 'omc.promoSeen.v1',
    promoUsed: 'omc.promoUsed.v1'
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* storage blocked: keep in memory */ }
  }

  // Merge saved settings over defaults so new default keys always exist.
  function mergeSettings(saved) {
    var base = clone(OMC.DEFAULTS.SETTINGS);
    if (!saved) return base;
    for (var k in saved) {
      if (k === 'promo') { for (var p in saved.promo) base.promo[p] = saved.promo[p]; }
      else base[k] = saved[k];
    }
    return base;
  }

  var state = {
    menu: read(KEYS.menu, null) || clone(OMC.DEFAULTS.MENU),
    settings: mergeSettings(read(KEYS.settings, null)),
    cart: read(KEYS.cart, []),
    orders: read(KEYS.orders, [])
  };

  var listeners = {};
  function on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); }
  function emit(evt, data) { (listeners[evt] || []).forEach(function (fn) { fn(data); }); }

  // FNV-1a — a casual client-side gate for the admin view, NOT real security.
  function hash(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16);
  }
  var DEFAULT_PASS = 'ohh2026';

  function uid() { return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  var store = {
    KEYS: KEYS,
    on: on,

    /* ---------- Menu ---------- */
    getMenu: function () { return state.menu; },
    getItem: function (id) { return state.menu.find(function (m) { return m.id === id; }); },
    categories: function () { return OMC.DEFAULTS.CATEGORIES; },
    categoryName: function (id) {
      var c = OMC.DEFAULTS.CATEGORIES.find(function (c) { return c.id === id; });
      return c ? c.name : id;
    },
    saveMenu: function (list) {
      state.menu = list;
      write(KEYS.menu, list);
      emit('menu', list);
    },
    upsertItem: function (item) {
      var list = state.menu.slice();
      if (!item.id) { item.id = uid(); list.push(item); }
      else {
        var i = list.findIndex(function (m) { return m.id === item.id; });
        if (i === -1) list.push(item); else list[i] = item;
      }
      item.isPizza = item.category === 'nonveg' || item.category === 'veg' || item.category === 'porkbuff';
      store.saveMenu(list);
      return item;
    },
    deleteItem: function (id) {
      store.saveMenu(state.menu.filter(function (m) { return m.id !== id; }));
      // Drop deleted items from the cart too.
      store.setCart(state.cart.filter(function (c) { return c.id !== id; }));
    },
    resetMenu: function () { store.saveMenu(clone(OMC.DEFAULTS.MENU)); },

    /* ---------- Settings ---------- */
    getSettings: function () { return state.settings; },
    saveSettings: function (s) {
      state.settings = mergeSettings(s);
      write(KEYS.settings, state.settings);
      emit('settings', state.settings);
    },
    resetSettings: function () { store.saveSettings(clone(OMC.DEFAULTS.SETTINGS)); },

    isOpenNow: function (date) {
      var s = state.settings, d = date || new Date();
      var mins = d.getHours() * 60 + d.getMinutes();
      function toMin(t) { var p = String(t).split(':'); return (+p[0]) * 60 + (+p[1] || 0); }
      var o = toMin(s.hoursOpen), c = toMin(s.hoursClose);
      return c > o ? (mins >= o && mins < c) : (mins >= o || mins < c); // handles past-midnight close
    },

    /* ---------- Auth ---------- */
    checkPass: function (p) { return hash(p) === read(KEYS.pass, hash(DEFAULT_PASS)); },
    setPass: function (p) { write(KEYS.pass, hash(p)); },
    isDefaultPass: function () { return read(KEYS.pass, hash(DEFAULT_PASS)) === hash(DEFAULT_PASS); },

    /* ---------- Cart ---------- */
    getCart: function () { return state.cart; },
    setCart: function (c) { state.cart = c; write(KEYS.cart, c); emit('cart', c); },
    addToCart: function (id, label, qty) {
      var item = store.getItem(id);
      if (!item) return;
      var price = (item.prices.find(function (p) { return p.label === label; }) || item.prices[0]);
      var cart = state.cart.slice();
      var line = cart.find(function (c) { return c.id === id && c.label === price.label; });
      if (line) line.qty += qty || 1;
      else cart.push({ id: id, label: price.label, qty: qty || 1 });
      store.setCart(cart);
    },
    setQty: function (id, label, qty) {
      var cart = state.cart
        .map(function (c) { return (c.id === id && c.label === label) ? { id: c.id, label: c.label, qty: qty } : c; })
        .filter(function (c) { return c.qty > 0; });
      store.setCart(cart);
    },
    clearCart: function () { store.setCart([]); },
    cartLines: function () {
      return state.cart.map(function (c) {
        var item = store.getItem(c.id);
        if (!item) return null;
        var p = item.prices.find(function (x) { return x.label === c.label; });
        if (!p) return null;
        return { id: c.id, label: c.label, qty: c.qty, name: item.name, unit: +p.price, total: +p.price * c.qty, item: item };
      }).filter(Boolean);
    },
    cartCount: function () { return state.cart.reduce(function (n, c) { return n + c.qty; }, 0); },

    /* Totals. The promo applies to ONE 22" XL pizza (the priciest one in the cart). */
    totals: function (code) {
      var s = state.settings, lines = store.cartLines();
      var subtotal = lines.reduce(function (n, l) { return n + l.total; }, 0);
      var discount = 0, promoMsg = '';
      if (code) {
        var promoOk = s.promo.enabled && code.trim().toUpperCase() === String(s.promo.code).toUpperCase();
        if (!promoOk) promoMsg = 'That code is not valid.';
        else if (store.promoUsed()) promoMsg = 'Promo already used on this device.';
        else {
          var xl = lines.filter(function (l) { return l.item.isPizza && /22/.test(l.label); })
                        .sort(function (a, b) { return b.unit - a.unit; })[0];
          if (!xl) promoMsg = 'Add a 22" XL pizza to use this code.';
          else { discount = Math.round(xl.unit * s.promo.percent / 100); promoMsg = s.promo.percent + '% off your 22" ' + xl.name + '!'; }
        }
      }
      var delivery = subtotal === 0 || subtotal - discount >= s.freeDeliveryOver ? 0 : +s.deliveryFee;
      return { subtotal: subtotal, discount: discount, delivery: delivery, total: subtotal - discount + delivery, promoMsg: promoMsg };
    },

    /* ---------- Promo flags ---------- */
    promoSeen: function () { try { return sessionStorage.getItem(KEYS.promoSeen) === '1'; } catch (e) { return false; } },
    markPromoSeen: function () { try { sessionStorage.setItem(KEYS.promoSeen, '1'); } catch (e) {} },
    promoUsed: function () { return read(KEYS.promoUsed, false); },
    markPromoUsed: function () { write(KEYS.promoUsed, true); },

    /* ---------- Orders log (local demo analytics for Admin) ---------- */
    getOrders: function () { return state.orders; },
    logOrder: function (order) {
      state.orders = [order].concat(state.orders).slice(0, 200);
      write(KEYS.orders, state.orders);
      emit('orders', state.orders);
    },
    clearOrders: function () { state.orders = []; write(KEYS.orders, []); emit('orders', []); },

    money: function (n) { return state.settings.currency + ' ' + Number(n || 0).toLocaleString('en-IN'); }
  };

  OMC.store = store;
})(window.OMC = window.OMC || {});
