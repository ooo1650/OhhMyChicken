/* ==========================================================================
   Cart — drawer, quantities, promo code, totals and WhatsApp checkout.
   ========================================================================== */
(function (OMC) {
  'use strict';
  var ui = OMC.ui, $ = ui.$, esc = ui.esc, store = OMC.store;
  var promoCode = '';

  function renderBadge() {
    var n = store.cartCount(), b = $('#cartCount');
    b.textContent = n; b.hidden = n === 0;
    $('#cartBtn').setAttribute('aria-label', 'Open cart, ' + n + ' item' + (n === 1 ? '' : 's'));
  }

  function render() {
    renderBadge();
    var lines = store.cartLines(), body = $('#cartBody'), foot = $('#cartFoot');
    if (!lines.length) {
      body.innerHTML = '<div class="empty"><p class="empty-ico">🛵💨</p><p>Your cart is empty.</p><a href="#/menu" class="btn btn-red btn-sm" data-close-cart>Browse the menu</a></div>';
      foot.hidden = true; return;
    }
    foot.hidden = false;
    body.innerHTML = '<ul class="cart-lines">' + lines.map(function (l) {
      return '<li class="cart-line" data-id="' + esc(l.id) + '" data-label="' + esc(l.label) + '">' +
        '<div class="cl-art">' + OMC.art.iconFor(l.item) + '</div>' +
        '<div class="cl-info"><b>' + esc(l.name) + '</b><span>' + esc(l.label) + ' · ' + store.money(l.unit) + '</span></div>' +
        '<div class="qty" role="group" aria-label="Quantity for ' + esc(l.name) + '">' +
          '<button type="button" data-step="-1" aria-label="Decrease">−</button><output>' + l.qty + '</output><button type="button" data-step="1" aria-label="Increase">+</button>' +
        '</div>' +
        '<b class="cl-total">' + store.money(l.total) + '</b>' +
      '</li>';
    }).join('') + '</ul>';

    var t = store.totals(promoCode);
    var msg = $('#promoMsg');
    msg.textContent = promoCode ? t.promoMsg : '';
    msg.className = 'promo-msg ' + (t.discount ? 'ok' : 'bad');
    var s = store.getSettings();
    $('#cartTotals').innerHTML =
      '<div><dt>Subtotal</dt><dd>' + store.money(t.subtotal) + '</dd></div>' +
      (t.discount ? '<div class="disc"><dt>Promo ' + esc(promoCode.toUpperCase()) + '</dt><dd>− ' + store.money(t.discount) + '</dd></div>' : '') +
      '<div><dt>Delivery' + (t.delivery ? ' <small>(free over ' + store.money(s.freeDeliveryOver) + ')</small>' : '') + '</dt><dd>' + (t.delivery ? store.money(t.delivery) : 'FREE') + '</dd></div>' +
      '<div class="grand"><dt>Total</dt><dd>' + store.money(t.total) + '</dd></div>';
  }

  function open() {
    render();
    $('#cartBackdrop').hidden = false;
    requestAnimationFrame(function () { $('#cartBackdrop').classList.add('is-open'); });
    ui.openModal($('#cartDrawer'), { onClose: function () {
      $('#cartBackdrop').classList.remove('is-open');
      setTimeout(function () { $('#cartBackdrop').hidden = true; }, 220);
    } });
  }
  function close() { ui.closeModal($('#cartDrawer')); }

  function checkout(e) {
    e.preventDefault();
    var f = e.target, data = { name: f.name.value.trim(), phone: f.phone.value.trim(), address: f.address.value.trim() };
    var missing = ['name', 'phone', 'address'].filter(function (k) { return !data[k]; });
    [f.name, f.phone, f.address].forEach(function (i) { i.classList.toggle('invalid', missing.indexOf(i.name) !== -1); });
    if (missing.length) return ui.toast('Please fill in your ' + missing.join(', '));
    if (!/^[+\d][\d\s-]{6,}$/.test(data.phone)) { f.phone.classList.add('invalid'); return ui.toast('Please enter a valid phone number'); }

    var s = store.getSettings(), lines = store.cartLines(), t = store.totals(promoCode);
    var text = '*New order — ' + s.name + '*\n\n' +
      lines.map(function (l) { return '• ' + l.qty + '× ' + l.name + ' (' + l.label + ') — ' + store.money(l.total); }).join('\n') +
      '\n\nSubtotal: ' + store.money(t.subtotal) +
      (t.discount ? '\nPromo ' + promoCode.toUpperCase() + ': −' + store.money(t.discount) : '') +
      '\nDelivery: ' + (t.delivery ? store.money(t.delivery) : 'FREE') +
      '\n*Total: ' + store.money(t.total) + '*' +
      '\n\nName: ' + data.name + '\nPhone: ' + data.phone + '\nAddress: ' + data.address;

    store.logOrder({
      at: Date.now(), name: data.name, total: t.total, discount: t.discount,
      items: lines.map(function (l) { return { id: l.id, name: l.name, label: l.label, qty: l.qty }; })
    });
    if (t.discount) store.markPromoUsed();

    var wa = String(s.whatsapp || '').replace(/\D/g, '');
    window.open('https://wa.me/' + wa + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
    store.clearCart();
    promoCode = ''; $('#promoInput').value = '';
    f.reset();
    close();
    ui.toast('🎉 Order sent! Finish in WhatsApp.');
  }

  function bind() {
    $('#cartBtn').addEventListener('click', open);
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-close-cart]')) close();
    });
    $('#cartBackdrop').addEventListener('click', close);
    $('#cartBody').addEventListener('click', function (e) {
      var b = e.target.closest('[data-step]'); if (!b) return;
      var li = b.closest('.cart-line'), line = store.getCart().find(function (c) { return c.id === li.dataset.id && c.label === li.dataset.label; });
      if (line) store.setQty(line.id, line.label, line.qty + (+b.dataset.step));
    });
    function applyPromo() {
      promoCode = $('#promoInput').value.trim();
      render();
    }
    $('#promoApply').addEventListener('click', applyPromo);
    $('#promoInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); applyPromo(); } });
    $('#checkoutForm').addEventListener('submit', checkout);
    store.on('cart', render);
    store.on('menu', render);
    store.on('settings', render);
  }

  OMC.cart = {
    init: function () { bind(); renderBadge(); },
    open: open,
    applyCode: function (code) { promoCode = code; $('#promoInput').value = code; render(); }
  };
})(window.OMC = window.OMC || {});
