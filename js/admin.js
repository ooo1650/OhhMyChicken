/* ==========================================================================
   Admin — passcode gate, Menu CMS (live search, add/edit/duplicate/delete,
   availability & featured toggles, import/export), store & promo settings,
   and a local orders overview.
   ========================================================================== */
(function (OMC) {
  'use strict';
  var ui = OMC.ui, $ = ui.$, $$ = ui.$$, esc = ui.esc, store = OMC.store;
  var AUTH_KEY = 'omc.admin.session';
  var view = { q: '', cat: 'all', sort: 'category', dir: 1 };

  function authed() { try { return sessionStorage.getItem(AUTH_KEY) === '1'; } catch (e) { return false; } }
  function setAuthed(v) { try { v ? sessionStorage.setItem(AUTH_KEY, '1') : sessionStorage.removeItem(AUTH_KEY); } catch (e) {} }

  /* ---------- Gate ---------- */
  function requestOpen() {
    if (authed()) return show();
    $('#loginError').textContent = '';
    $('#loginPass').value = '';
    $('#loginHint').textContent = store.isDefaultPass() ? 'First time? The default passcode is “ohh2026” — change it under Store & Promo.' : '';
    ui.openModal($('#loginModal'), { focus: '#loginPass', onClose: function () {
      if (!authed() && location.hash.indexOf('#/admin') === 0) history.replaceState(null, '', '#/');
    } });
  }

  function show() {
    document.body.classList.add('admin-mode');
    $('#adminView').hidden = false;
    window.scrollTo(0, 0);
    renderAll();
    $('#adminSearch').focus({ preventScroll: true });
  }
  function hide() {
    document.body.classList.remove('admin-mode');
    $('#adminView').hidden = true;
  }

  /* ---------- Search ---------- */
  // Supports text, exact/partial price ("650"), comparisons ("<500", ">=1000") and ranges ("500-800").
  function matches(item, q) {
    if (!q) return true;
    var prices = item.prices.map(function (p) { return +p.price; });
    return q.toLowerCase().split(/\s+/).filter(Boolean).every(function (tok) {
      var m;
      if ((m = tok.match(/^(<=|>=|<|>)(\d+)$/))) {
        var n = +m[2];
        return prices.some(function (p) { return m[1] === '<' ? p < n : m[1] === '>' ? p > n : m[1] === '<=' ? p <= n : p >= n; });
      }
      if ((m = tok.match(/^(\d+)-(\d+)$/))) return prices.some(function (p) { return p >= +m[1] && p <= +m[2]; });
      if (/^\d+$/.test(tok)) return prices.some(function (p) { return String(p).indexOf(tok) !== -1; });
      var hay = [item.name, item.desc, store.categoryName(item.category), ui.dietLabel(item.diet), item.available ? 'available' : 'sold out', item.popular ? 'featured' : '',
        item.prices.map(function (p) { return p.label; }).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(tok) !== -1;
    });
  }

  function catOrder(id) { return store.categories().findIndex(function (c) { return c.id === id; }); }
  function minPrice(i) { return Math.min.apply(null, i.prices.map(function (p) { return +p.price; })); }

  /* ---------- Render ---------- */
  function renderKpis() {
    var m = store.getMenu();
    var avail = m.filter(function (i) { return i.available; }).length;
    $('#adminKpis').innerHTML = kpi('Menu items', m.length) + kpi('Available', avail) + kpi('Sold out', m.length - avail, m.length - avail ? 'warn' : '') + kpi('Featured', m.filter(function (i) { return i.popular; }).length);
  }
  function kpi(label, val, cls) { return '<div class="kpi ' + (cls || '') + '"><b>' + val + '</b><span>' + label + '</span></div>'; }

  function renderCatFilter() {
    var opts = '<option value="all">All categories</option>' + store.categories().map(function (c) { return '<option value="' + c.id + '">' + esc(c.short) + '</option>'; }).join('');
    $('#adminCatFilter').innerHTML = opts;
    $('#adminCatFilter').value = view.cat;
    $('#itemCategory').innerHTML = store.categories().map(function (c) { return '<option value="' + c.id + '">' + esc(c.name) + '</option>'; }).join('');
  }

  function renderRows() {
    var q = view.q.trim();
    var rows = store.getMenu().filter(function (i) { return (view.cat === 'all' || i.category === view.cat) && matches(i, q); });
    rows.sort(function (a, b) {
      var r;
      if (view.sort === 'name') r = a.name.localeCompare(b.name);
      else if (view.sort === 'price') r = minPrice(a) - minPrice(b);
      else r = catOrder(a.category) - catOrder(b.category);
      return r * view.dir;
    });
    $$('.admin-table th[data-sort]').forEach(function (th) {
      th.setAttribute('aria-sort', th.dataset.sort === view.sort ? (view.dir === 1 ? 'ascending' : 'descending') : 'none');
    });
    $('#adminRows').innerHTML = rows.length ? rows.map(function (i) {
      var cat = store.categories().find(function (c) { return c.id === i.category; }) || { short: i.category, icon: '' };
      return '<tr data-id="' + esc(i.id) + '" class="' + (i.available ? '' : 'row-off') + '">' +
        '<td data-label="Item"><div class="cell-item"><span class="diet">' + ui.dietIcon(i.diet) + '</span><div><b>' + esc(i.name) + '</b>' + (i.desc ? '<small>' + esc(i.desc) + '</small>' : '') + '</div></div></td>' +
        '<td data-label="Category"><span class="cat-pill">' + cat.icon + ' ' + esc(cat.short) + '</span></td>' +
        '<td data-label="Prices"><div class="price-chips">' + i.prices.map(function (p) { return '<span><em>' + esc(p.label) + '</em> ' + store.money(p.price) + '</span>'; }).join('') + '</div></td>' +
        '<td data-label="Status"><div class="status-cell">' +
          '<label class="switch switch-sm" title="Available"><input type="checkbox" data-toggle="available"' + (i.available ? ' checked' : '') + ' aria-label="Available: ' + esc(i.name) + '"><span></span></label>' +
          '<button type="button" class="star' + (i.popular ? ' on' : '') + '" data-toggle="popular" aria-pressed="' + i.popular + '" aria-label="Featured: ' + esc(i.name) + '">★</button>' +
        '</div></td>' +
        '<td class="row-actions">' +
          '<button type="button" class="icon-btn" data-action="edit" aria-label="Edit ' + esc(i.name) + '">✏️</button>' +
          '<button type="button" class="icon-btn" data-action="dup" aria-label="Duplicate ' + esc(i.name) + '">⧉</button>' +
          '<button type="button" class="icon-btn danger" data-action="del" aria-label="Delete ' + esc(i.name) + '">🗑️</button>' +
        '</td></tr>';
    }).join('') : '<tr><td colspan="5" class="empty-row">No items match “' + esc(q) + '”.</td></tr>';
    $('#adminCount').textContent = rows.length + ' of ' + store.getMenu().length + ' items';
  }

  function renderSettings() {
    var s = store.getSettings(), f = $('#settingsForm');
    $$('input', f).forEach(function (inp) {
      if (inp.name === 'newPass') { inp.value = ''; return; }
      var val = inp.name.indexOf('promo.') === 0 ? s.promo[inp.name.slice(6)] : s[inp.name];
      if (inp.type === 'checkbox') inp.checked = !!val; else inp.value = val == null ? '' : val;
    });
  }

  function renderOrders() {
    var orders = store.getOrders();
    var revenue = orders.reduce(function (n, o) { return n + o.total; }, 0);
    $('#orderKpis').innerHTML = kpi('Orders', orders.length) + kpi('Revenue', store.money(revenue)) +
      kpi('Avg order', store.money(orders.length ? Math.round(revenue / orders.length) : 0)) +
      kpi('Promo used', orders.filter(function (o) { return o.discount > 0; }).length);

    var tally = {};
    orders.forEach(function (o) { o.items.forEach(function (i) { tally[i.name] = (tally[i.name] || 0) + i.qty; }); });
    var top = Object.keys(tally).map(function (k) { return [k, tally[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6);
    var max = top.length ? top[0][1] : 1;
    $('#topSellers').innerHTML = top.length ? top.map(function (t) {
      return '<li><span>' + esc(t[0]) + '</span><i style="--w:' + Math.round(t[1] / max * 100) + '%"></i><b>' + t[1] + '</b></li>';
    }).join('') : '<li class="muted">No orders yet. Orders placed on this device appear here.</li>';

    $('#orderList').innerHTML = orders.slice(0, 12).map(function (o) {
      return '<li><div><b>' + esc(o.name) + '</b><small>' + new Date(o.at).toLocaleString() + '</small><small>' +
        o.items.map(function (i) { return i.qty + '× ' + esc(i.name) + ' (' + esc(i.label) + ')'; }).join(', ') + '</small></div><b>' + store.money(o.total) + '</b></li>';
    }).join('') || '<li class="muted">Nothing here yet.</li>';
  }

  function renderAll() { renderKpis(); renderCatFilter(); renderRows(); renderSettings(); renderOrders(); }

  /* ---------- Item editor ---------- */
  function priceRow(label, price) {
    return '<div class="price-row"><input type="text" class="pr-label" placeholder="Label (e.g. 22&quot; XL)" value="' + esc(label || '') + '" aria-label="Variant label" maxlength="20">' +
      '<input type="number" class="pr-price" placeholder="Price" min="0" step="10" value="' + (price == null ? '' : esc(price)) + '" aria-label="Price">' +
      '<button type="button" class="icon-btn danger" data-remove-row aria-label="Remove variant">✕</button></div>';
  }

  function openEditor(item, isCopy) {
    var f = $('#itemForm');
    f.reset();
    $('#itemError').textContent = '';
    var data = item ? JSON.parse(JSON.stringify(item)) : { name: '', category: view.cat !== 'all' ? view.cat : 'nonveg', diet: 'chicken', desc: '', prices: [], available: true, popular: false };
    if (isCopy) { data.id = ''; data.name += ' (copy)'; }
    if (!data.prices.length && ['nonveg', 'veg', 'porkbuff'].indexOf(data.category) !== -1) data.prices = OMC.DEFAULTS.SIZES.map(function (s) { return { label: s.label, price: '' }; });
    if (!data.prices.length) data.prices = [{ label: 'Regular', price: '' }];
    $('#itemModalTitle').textContent = item && !isCopy ? 'Edit ' + item.name : 'Add menu item';
    f.id.value = data.id || '';
    f.name.value = data.name;
    f.category.value = data.category;
    f.diet.value = data.diet;
    f.desc.value = data.desc || '';
    f.available.checked = data.available !== false;
    f.popular.checked = !!data.popular;
    $('#priceRows').innerHTML = data.prices.map(function (p) { return priceRow(p.label, p.price); }).join('');
    ui.openModal($('#itemModal'), { focus: '[name=name]' });
  }

  function saveEditor(e) {
    e.preventDefault();
    var f = e.target, err = $('#itemError');
    var name = f.name.value.trim();
    var prices = $$('.price-row', f).map(function (r) {
      return { label: $('.pr-label', r).value.trim(), price: $('.pr-price', r).value };
    }).filter(function (p) { return p.label || p.price !== ''; });

    if (!name) { err.textContent = 'Please enter a name.'; f.name.focus(); return; }
    if (!prices.length) { err.textContent = 'Add at least one price.'; return; }
    for (var i = 0; i < prices.length; i++) {
      if (!prices[i].label) { err.textContent = 'Every price needs a label.'; return; }
      if (prices[i].price === '' || isNaN(+prices[i].price) || +prices[i].price < 0) { err.textContent = 'Price for “' + prices[i].label + '” must be 0 or more.'; return; }
      prices[i].price = Math.round(+prices[i].price);
    }
    var labels = prices.map(function (p) { return p.label.toLowerCase(); });
    if (labels.some(function (l, i) { return labels.indexOf(l) !== i; })) { err.textContent = 'Variant labels must be unique.'; return; }
    var dupe = store.getMenu().find(function (m) { return m.name.toLowerCase() === name.toLowerCase() && m.id !== f.id.value; });
    if (dupe) { err.textContent = 'An item called “' + dupe.name + '” already exists.'; return; }

    var saved = store.upsertItem({
      id: f.id.value || '', name: name, category: f.category.value, diet: f.diet.value, desc: f.desc.value.trim(),
      prices: prices, available: f.available.checked, popular: f.popular.checked
    });
    ui.closeModal($('#itemModal'));
    ui.toast('✅ Saved “' + saved.name + '”');
  }

  /* ---------- Import / export ---------- */
  function exportMenu() {
    var blob = new Blob([JSON.stringify({ menu: store.getMenu(), settings: store.getSettings() }, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ohh-my-chicken-menu-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function validMenu(list) {
    var cats = store.categories().map(function (c) { return c.id; });
    return Array.isArray(list) && list.length > 0 && list.every(function (m) {
      return m && typeof m.name === 'string' && m.name.trim() && cats.indexOf(m.category) !== -1 &&
        Array.isArray(m.prices) && m.prices.length && m.prices.every(function (p) { return p && typeof p.label === 'string' && isFinite(+p.price); });
    });
  }

  function importMenu(e) {
    var file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try { data = JSON.parse(reader.result); } catch (x) { return ui.toast('⚠️ That file is not valid JSON'); }
      var list = Array.isArray(data) ? data : data.menu;
      if (!validMenu(list)) return ui.toast('⚠️ File does not look like an OMC menu export');
      ui.confirm('Replace the current menu with ' + list.length + ' items from “' + file.name + '”?', 'Replace menu').then(function (ok) {
        if (!ok) return;
        store.saveMenu(list.map(function (m, i) {
          return {
            id: m.id || 'imp' + i + Date.now().toString(36), name: m.name.trim(), category: m.category, diet: m.diet || 'veg', desc: m.desc || '',
            prices: m.prices.map(function (p) { return { label: p.label, price: Math.round(+p.price) }; }),
            available: m.available !== false, popular: !!m.popular, isPizza: ['nonveg', 'veg', 'porkbuff'].indexOf(m.category) !== -1
          };
        }));
        if (data.settings) store.saveSettings(data.settings);
        ui.toast('✅ Imported ' + list.length + ' items');
      });
    };
    reader.readAsText(file);
  }

  /* ---------- Events ---------- */
  function bind() {
    $('#loginForm').addEventListener('submit', function (e) {
      e.preventDefault();
      if (store.checkPass($('#loginPass').value)) {
        setAuthed(true);
        ui.closeModal($('#loginModal'));
        show();
      } else {
        $('#loginError').textContent = 'Wrong passcode. Try again.';
        $('#loginPass').select();
        var card = $('.login-card');
        card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
      }
    });
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-close-login]')) ui.closeModal($('#loginModal'));
      if (e.target.closest('[data-close-item]')) ui.closeModal($('#itemModal'));
    });
    $('#adminLogout').addEventListener('click', function () { setAuthed(false); hide(); location.hash = '#/'; ui.toast('🔒 Dashboard locked'); });

    // Tabs
    $('.admin-tabs').addEventListener('click', function (e) {
      var b = e.target.closest('[data-tab]'); if (!b) return;
      $$('.admin-tabs [data-tab]').forEach(function (t) { t.setAttribute('aria-selected', String(t === b)); });
      $$('.admin-panel').forEach(function (p) { p.hidden = p.dataset.panel !== b.dataset.tab; });
    });

    // Search / filter / sort
    $('#adminSearch').addEventListener('input', ui.debounce(function (e) { view.q = e.target.value; renderRows(); }, 60));
    $('#adminCatFilter').addEventListener('change', function (e) { view.cat = e.target.value; renderRows(); });
    $$('.admin-table th[data-sort]').forEach(function (th) {
      th.tabIndex = 0;
      var go = function () { view.dir = view.sort === th.dataset.sort ? -view.dir : 1; view.sort = th.dataset.sort; renderRows(); };
      th.addEventListener('click', go);
      th.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });

    // Row actions
    $('#adminRows').addEventListener('click', function (e) {
      var tr = e.target.closest('tr[data-id]'); if (!tr) return;
      var item = store.getItem(tr.dataset.id); if (!item) return;
      var btn = e.target.closest('[data-action]');
      var tog = e.target.closest('button[data-toggle]');
      if (tog) { item.popular = !item.popular; store.upsertItem(item); return; }
      if (!btn) return;
      if (btn.dataset.action === 'edit') openEditor(item);
      if (btn.dataset.action === 'dup') openEditor(item, true);
      if (btn.dataset.action === 'del') {
        ui.confirm('Delete “' + item.name + '” from the menu?', 'Delete').then(function (ok) {
          if (ok) { store.deleteItem(item.id); ui.toast('🗑️ Deleted “' + item.name + '”'); }
        });
      }
    });
    $('#adminRows').addEventListener('change', function (e) {
      if (e.target.dataset.toggle !== 'available') return;
      var item = store.getItem(e.target.closest('tr').dataset.id);
      item.available = e.target.checked;
      store.upsertItem(item);
      ui.toast(item.available ? '✅ ' + item.name + ' is back on' : '⛔ ' + item.name + ' marked sold out');
    });

    $('#adminAdd').addEventListener('click', function () { openEditor(null); });
    $('#itemForm').addEventListener('submit', saveEditor);
    $('#addPriceRow').addEventListener('click', function () {
      $('#priceRows').insertAdjacentHTML('beforeend', priceRow('', ''));
      $$('.pr-label', $('#priceRows')).pop().focus();
    });
    $('#pizzaSizesRow').addEventListener('click', function () {
      var existing = {};
      $$('.price-row').forEach(function (r) { existing[$('.pr-label', r).value.trim()] = $('.pr-price', r).value; });
      $('#priceRows').innerHTML = OMC.DEFAULTS.SIZES.map(function (s) { return priceRow(s.label, existing[s.label] || ''); }).join('');
    });
    // Switching category while prices are still blank swaps in sensible variant rows.
    $('#itemCategory').addEventListener('change', function (e) {
      var blank = $$('.pr-price', $('#priceRows')).every(function (i) { return i.value === ''; });
      if (!blank) return;
      var pizza = ['nonveg', 'veg', 'porkbuff'].indexOf(e.target.value) !== -1;
      $('#priceRows').innerHTML = pizza
        ? OMC.DEFAULTS.SIZES.map(function (s) { return priceRow(s.label, ''); }).join('')
        : priceRow('Regular', '');
    });
    $('#priceRows').addEventListener('click', function (e) {
      if (!e.target.closest('[data-remove-row]')) return;
      if ($$('.price-row').length === 1) return ui.toast('An item needs at least one price');
      e.target.closest('.price-row').remove();
    });

    $('#exportMenu').addEventListener('click', exportMenu);
    $('#importMenu').addEventListener('change', importMenu);
    $('#resetMenu').addEventListener('click', function () {
      ui.confirm('Reset the whole menu to the original defaults? Your edits will be lost.', 'Reset menu').then(function (ok) {
        if (ok) { store.resetMenu(); ui.toast('↺ Menu reset to defaults'); }
      });
    });

    // Settings
    $('#settingsForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, s = JSON.parse(JSON.stringify(store.getSettings()));
      if (!f.checkValidity()) { f.reportValidity(); return; }
      $$('input', f).forEach(function (inp) {
        if (inp.name === 'newPass') return;
        var v = inp.type === 'checkbox' ? inp.checked : inp.type === 'number' ? +inp.value : inp.value.trim();
        if (inp.name.indexOf('promo.') === 0) s.promo[inp.name.slice(6)] = v; else s[inp.name] = v;
      });
      s.promo.code = String(s.promo.code).toUpperCase();
      if (f.newPass.value) {
        if (f.newPass.value.length < 4) { ui.toast('Passcode must be at least 4 characters'); return; }
        store.setPass(f.newPass.value);
        f.newPass.value = '';
      }
      store.saveSettings(s);
      ui.toast('✅ Settings saved');
    });
    $('#resetSettings').addEventListener('click', function () {
      ui.confirm('Reset store info and promo to defaults?', 'Reset').then(function (ok) { if (ok) { store.resetSettings(); ui.toast('↺ Settings reset'); } });
    });
    $('#previewPromo').addEventListener('click', function () { OMC.app.showPromo(true); });
    $('#clearOrders').addEventListener('click', function () {
      ui.confirm('Clear the local order log?', 'Clear').then(function (ok) { if (ok) store.clearOrders(); });
    });

    store.on('menu', function () { if (!$('#adminView').hidden) { renderKpis(); renderRows(); } });
    store.on('settings', function () { if (!$('#adminView').hidden) { renderSettings(); renderRows(); } });
    store.on('orders', function () { if (!$('#adminView').hidden) renderOrders(); });
  }

  OMC.admin = { init: bind, requestOpen: requestOpen, hide: hide, isOpen: function () { return !$('#adminView').hidden; } };
})(window.OMC = window.OMC || {});
