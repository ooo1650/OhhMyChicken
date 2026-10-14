/* ==========================================================================
   Menu — customer menu with instant search, category + diet filters,
   variant pickers and add-to-cart. Also renders the home "popular" row.
   ========================================================================== */
(function (OMC) {
  'use strict';
  var ui = OMC.ui, $ = ui.$, $$ = ui.$$, esc = ui.esc, store = OMC.store;

  var state = { q: '', cat: 'all', diet: 'all' };
  var DIETS = [
    { id: 'all', label: 'All' }, { id: 'veg', label: '🟢 Veg' }, { id: 'chicken', label: '🍗 Chicken' },
    { id: 'buff', label: '🐃 Buff' }, { id: 'pork', label: '🐖 Pork' }
  ];

  function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  // "Strong" text: what a dish IS (name, description, diet, pizza/size words).
  function strongText(item) {
    return norm([item.name, item.desc, ui.dietLabel(item.diet), item.isPizza ? 'pizza' : '',
      item.prices.map(function (p) { return p.label; }).join(' ')].join(' '));
  }

  // Every query word must match. A word is matched against the category name only
  // when no dish matches it directly — so "buff" finds buff dishes, while
  // "specials" or "extras" still filter by category.
  function makeMatcher(q) {
    var words = norm(q).split(/\s+/).filter(Boolean);
    if (!words.length) return function () { return true; };
    var menu = store.getMenu();
    var strong = {};
    menu.forEach(function (m) { strong[m.id] = strongText(m); });
    var useCat = words.map(function (w) { return !menu.some(function (m) { return strong[m.id].indexOf(w) !== -1; }); });
    return function (item) {
      return words.every(function (w, i) {
        return strong[item.id].indexOf(w) !== -1 || (useCat[i] && norm(store.categoryName(item.category)).indexOf(w) !== -1);
      });
    };
  }

  function highlight(text, q) {
    var safe = esc(text);
    if (!q) return safe;
    var words = q.trim().split(/\s+/).filter(function (w) { return w.length > 1; })
      .map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
    if (!words.length) return safe;
    return safe.replace(new RegExp('(' + words.join('|') + ')', 'gi'), '<mark>$1</mark>');
  }

  function dietMatch(item) {
    if (state.diet === 'all') return true;
    if (item.diet === state.diet) return true;
    return item.diet === 'mix' && state.diet !== 'veg'; // mixed meat counts for every meat filter
  }

  function card(item, q) {
    var first = item.prices[0];
    var variants = item.prices.length > 1
      ? '<div class="variants" role="radiogroup" aria-label="Choose option for ' + esc(item.name) + '">' +
          item.prices.map(function (p, i) {
            return '<button type="button" role="radio" aria-checked="' + (i === 0) + '" data-label="' + esc(p.label) + '" data-price="' + p.price + '"' +
                   (/22/.test(p.label) ? ' class="is-xl"' : '') + '>' + esc(p.label) + '</button>';
          }).join('') + '</div>'
      : '<p class="single-variant">' + esc(first.label) + '</p>';
    return '<article class="food-card' + (item.available ? '' : ' sold-out') + '" data-id="' + esc(item.id) + '" data-label="' + esc(first.label) + '">' +
      '<div class="fc-art">' + OMC.art.iconFor(item) + (item.popular ? '<span class="fc-flag">🔥 Popular</span>' : '') + '</div>' +
      '<div class="fc-body">' +
        '<div class="fc-top"><h3>' + highlight(item.name, q) + '</h3><span class="diet diet-' + esc(item.diet) + '" title="' + esc(ui.dietLabel(item.diet)) + '">' + ui.dietIcon(item.diet) + '</span></div>' +
        (item.desc ? '<p class="fc-desc">' + highlight(item.desc, q) + '</p>' : '') +
        variants +
        '<div class="fc-foot"><span class="fc-price">' + store.money(first.price) + '</span>' +
          (item.available
            ? '<button type="button" class="btn btn-red btn-sm add-btn" aria-label="Add ' + esc(item.name) + ' to cart">＋ Add</button>'
            : '<span class="sold-tag">Sold out</span>') +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function renderChips() {
    var cats = [{ id: 'all', short: 'All', icon: '✨' }].concat(store.categories());
    $('#categoryChips').innerHTML = cats.map(function (c) {
      return '<button type="button" role="tab" class="chip" aria-selected="' + (state.cat === c.id) + '" data-cat="' + c.id + '">' + c.icon + ' ' + esc(c.short) + '</button>';
    }).join('');
    $('#dietChips').innerHTML = DIETS.map(function (d) {
      return '<button type="button" class="chip chip-sm" aria-pressed="' + (state.diet === d.id) + '" data-diet="' + d.id + '">' + d.label + '</button>';
    }).join('');
  }

  function renderMenu() {
    var menu = store.getMenu(), q = state.q.trim(), total = 0, matches = makeMatcher(q);
    var html = store.categories().map(function (c) {
      if (state.cat !== 'all' && state.cat !== c.id) return '';
      var items = menu.filter(function (m) { return m.category === c.id && dietMatch(m) && matches(m); });
      if (!items.length) return '';
      total += items.length;
      return '<section class="menu-cat" aria-labelledby="cat-' + c.id + '">' +
        '<h2 class="cat-title" id="cat-' + c.id + '"><span>' + c.icon + '</span> ' + esc(c.name) + ' <small>' + items.length + '</small></h2>' +
        (['nonveg', 'veg', 'porkbuff'].indexOf(c.id) !== -1 ? '<p class="cat-sizes">12" S · 15" M · 18" L · <b>22" XL</b></p>' : '') +
        '<div class="card-grid">' + items.map(function (i) { return card(i, q); }).join('') + '</div></section>';
    }).join('');

    $('#menuList').innerHTML = html || '<div class="empty"><p class="empty-ico">🍕❓</p><p>No dishes match “' + esc(q) + '”.</p><button class="btn btn-outline btn-sm" id="clearSearch">Clear filters</button></div>';
    $('#resultCount').textContent = total ? total + ' item' + (total === 1 ? '' : 's') + (q ? ' for “' + q + '”' : '') : '';
  }

  function renderPopular() {
    var picks = store.getMenu().filter(function (m) { return m.popular && m.available; }).slice(0, 8);
    $('#popularRow').innerHTML = picks.map(function (i) { return card(i, ''); }).join('');
  }

  /* ---------- Events (delegated) ---------- */
  function onCardClick(e) {
    var cardEl = e.target.closest('.food-card');
    if (!cardEl) return;
    var v = e.target.closest('.variants button');
    if (v) {
      $$('.variants button', cardEl).forEach(function (b) { b.setAttribute('aria-checked', b === v ? 'true' : 'false'); });
      cardEl.dataset.label = v.dataset.label;
      $('.fc-price', cardEl).textContent = store.money(v.dataset.price);
      return;
    }
    var add = e.target.closest('.add-btn');
    if (add) {
      store.addToCart(cardEl.dataset.id, cardEl.dataset.label, 1);
      var item = store.getItem(cardEl.dataset.id);
      ui.toast('🍕 ' + item.name + ' (' + cardEl.dataset.label + ') added!');
      flyToCart(add);
    }
  }

  function flyToCart(from) {
    if (!ui.hasGsap()) return;
    var target = $('#cartBtn').getBoundingClientRect(), src = from.getBoundingClientRect();
    var dot = document.createElement('span');
    dot.className = 'fly-dot';
    dot.textContent = '🍕';
    dot.style.left = src.left + src.width / 2 + 'px';
    dot.style.top = src.top + 'px';
    document.body.appendChild(dot);
    window.gsap.to(dot, {
      x: target.left + target.width / 2 - (src.left + src.width / 2), y: target.top - src.top,
      scale: .5, rotation: 360, duration: .7, ease: 'power2.in',
      onComplete: function () {
        dot.remove();
        window.gsap.fromTo('#cartBtn', { scale: 1.3 }, { scale: 1, duration: .4, ease: 'back.out(3)' });
      }
    });
  }

  function bind() {
    var search = $('#menuSearch');
    search.addEventListener('input', ui.debounce(function () { state.q = search.value; renderMenu(); }, 80));
    $('#categoryChips').addEventListener('click', function (e) {
      var b = e.target.closest('[data-cat]'); if (!b) return;
      state.cat = b.dataset.cat; renderChips(); renderMenu();
    });
    $('#dietChips').addEventListener('click', function (e) {
      var b = e.target.closest('[data-diet]'); if (!b) return;
      state.diet = b.dataset.diet; renderChips(); renderMenu();
    });
    $('#menuList').addEventListener('click', function (e) {
      if (e.target.id === 'clearSearch') {
        state = { q: '', cat: 'all', diet: 'all' }; search.value = ''; renderChips(); renderMenu(); return;
      }
      onCardClick(e);
    });
    $('#popularRow').addEventListener('click', onCardClick);

    // "/" focuses search on the menu view
    document.addEventListener('keydown', function (e) {
      if (e.key !== '/' || /input|textarea|select/i.test(document.activeElement.tagName)) return;
      if ($('#view-menu').hidden) return;
      e.preventDefault(); search.focus();
    });

    store.on('menu', function () { renderMenu(); renderPopular(); });
    store.on('settings', function () { renderMenu(); renderPopular(); });
  }

  OMC.menu = {
    init: function () { renderChips(); renderMenu(); renderPopular(); bind(); },
    setQuery: function (q) { state.q = q; $('#menuSearch').value = q; renderMenu(); },
    setCategory: function (c) { state.cat = c; renderChips(); renderMenu(); }
  };
})(window.OMC = window.OMC || {});
