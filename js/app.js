/* ==========================================================================
   App — hash router, settings → DOM bindings, offer pop-up, header/nav.
   ========================================================================== */
(function (OMC) {
  'use strict';
  var ui = OMC.ui, $ = ui.$, $$ = ui.$$, store = OMC.store;
  var currentView = null;

  /* ---------- Router ---------- */
  function parse() {
    var h = location.hash.replace(/^#\/?/, '');
    var parts = h.split('?');
    var params = {};
    (parts[1] || '').split('&').forEach(function (kv) { if (!kv) return; var p = kv.split('='); params[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); });
    return { path: parts[0] || '', params: params };
  }

  function showView(name) {
    if (currentView === name) return false;
    $$('.view').forEach(function (v) { v.hidden = v.dataset.view !== name; });
    currentView = name;
    var el = $('#view-' + name);
    if (ui.hasGsap()) window.gsap.fromTo(el, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: .45, ease: 'power2.out', clearProps: 'transform' });
    return true;
  }

  function setActiveNav(key) {
    $$('[data-nav]').forEach(function (a) { a.classList.toggle('active', a.dataset.nav === key); if (a.dataset.nav === key) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  }

  function route() {
    var r = parse();
    closeNav();
    if (r.path === 'admin') {
      if (!currentView) showView('home');
      OMC.admin.requestOpen();
      return;
    }
    if (OMC.admin.isOpen()) OMC.admin.hide();

    if (r.path === 'menu') {
      showView('menu');
      setActiveNav('menu');
      window.scrollTo(0, 0);
      var note = $('#tableNote');
      if (r.params.table) {
        note.innerHTML = '🪑 Ordering for <b>Table ' + ui.esc(r.params.table) + '</b> · every pizza in 12" · 15" · 18" · <b>22" XL</b>';
        var addr = $('#checkoutForm').address;
        if (!addr.value) addr.value = 'Table ' + r.params.table;
      }
      document.title = 'Menu — Ohh My Chicken!';
      return;
    }
    var changed = showView('home');
    document.title = 'Ohh My Chicken! — Giant 22" Pizzas, Crispy Chicken & MoMo';
    if (r.path === 'sizes' || r.path === 'find') {
      setActiveNav(r.path);
      var target = $('#' + r.path);
      setTimeout(function () {
        var y = target.getBoundingClientRect().top + window.scrollY - $('#siteHeader').offsetHeight + 1;
        window.scrollTo({ top: y, behavior: ui.reducedMotion || changed ? 'auto' : 'smooth' });
      }, changed ? 60 : 0);
    } else {
      setActiveNav('home');
      if (changed) window.scrollTo(0, 0);
      else window.scrollTo({ top: 0, behavior: ui.reducedMotion ? 'auto' : 'smooth' });
    }
  }

  /* ---------- Mobile nav ---------- */
  function closeNav() {
    $('#mainNav').classList.remove('open');
    $('#navToggle').setAttribute('aria-expanded', 'false');
  }

  /* ---------- Settings → DOM ---------- */
  function applySettings() {
    var s = store.getSettings();
    var fmt = function (t) { var p = String(t).split(':'), h = +p[0]; return ((h % 12) || 12) + ':' + (p[1] || '00') + (h < 12 ? ' AM' : ' PM'); };
    $('#infoAddress').textContent = s.address;
    $('#infoHours').textContent = fmt(s.hoursOpen) + ' – ' + fmt(s.hoursClose);
    var tel = $('#infoPhone'); tel.textContent = s.phone; tel.href = 'tel:' + s.phone.replace(/\s/g, '');
    $('#infoFree').textContent = store.money(s.freeDeliveryOver);
    $('#statDelivery').textContent = s.deliveryMins;
    $$('.js-delivery-mins').forEach(function (n) { n.textContent = s.deliveryMins; });
    $('#promoTitle').textContent = s.promo.headline;
    $('#promoCode').textContent = s.promo.code;
    $('#promoPct').textContent = s.promo.percent + '%';
    var open = store.isOpenNow(), pill = $('#openPill');
    pill.textContent = open ? 'Open now' : 'Closed';
    pill.className = 'open-pill ' + (open ? 'is-open' : 'is-closed');
  }
  function applyMenuStats() { $('#statItems').textContent = store.getMenu().length; }

  /* ---------- Offer pop-up ---------- */
  function showPromo(force) {
    var s = store.getSettings();
    if (!force && (!s.promo.enabled || store.promoSeen() || OMC.admin.isOpen() || document.documentElement.classList.contains('no-scroll'))) return;
    store.markPromoSeen();
    ui.openModal($('#promoModal'), { focus: '#promoCodeBtn' });
    if (ui.hasGsap()) {
      window.gsap.fromTo('.promo-card', { scale: .6, rotation: -6, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: .6, ease: 'back.out(2)' });
      window.gsap.fromTo('.promo-burst', { rotation: -180, scale: 0 }, { rotation: -12, scale: 1, duration: .8, delay: .15, ease: 'back.out(2.5)' });
    }
  }

  function bind() {
    window.addEventListener('hashchange', route);

    $('#navToggle').addEventListener('click', function () {
      var open = $('#mainNav').classList.toggle('open');
      this.setAttribute('aria-expanded', String(open));
    });
    // Re-clicking the current hash link still routes (e.g. scrolling to #find twice)
    $$('a[href^="#/"]').forEach(function (a) {
      a.addEventListener('click', function () { if (a.getAttribute('href') === location.hash) setTimeout(route, 0); });
    });

    document.addEventListener('click', function (e) { if (e.target.closest('[data-close-modal]')) ui.closeModal($('#promoModal')); });
    $('#promoCodeBtn').addEventListener('click', function () {
      var code = store.getSettings().promo.code;
      var done = function () { ui.toast('📋 Code ' + code + ' copied & added to your cart!'); };
      OMC.cart.applyCode(code);
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done, done); else done();
    });

    var header = $('#siteHeader');
    window.addEventListener('scroll', function () { header.classList.toggle('scrolled', window.scrollY > 10); }, { passive: true });

    store.on('settings', applySettings);
    store.on('menu', applyMenuStats);
    setInterval(applySettings, 60000); // keep the open/closed pill honest
  }

  function init() {
    $('#year').textContent = new Date().getFullYear();
    applySettings();
    applyMenuStats();
    OMC.hero.init();
    OMC.menu.init();
    OMC.qr.init();
    OMC.cart.init();
    OMC.chat.init();
    OMC.admin.init();
    bind();
    route();
    OMC.hero.reveals();
    setTimeout(showPromo, Math.max(0, +store.getSettings().promo.delaySec || 0) * 1000);
  }

  OMC.app = { showPromo: showPromo };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window.OMC = window.OMC || {});
