/* ==========================================================================
   UI helpers — DOM shortcuts, escaping, toast, accessible modals, confirm.
   ========================================================================== */
(function (OMC) {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function debounce(fn, ms) {
    var t;
    return function () { var a = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms); };
  }

  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = function () { return typeof window.gsap !== 'undefined' && !reducedMotion; };

  /* ---------- Toast ---------- */
  var toastTimer;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    el.classList.remove('show');
    void el.offsetWidth; // restart transition
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () { el.hidden = true; }, 300);
    }, 2200);
  }

  /* ---------- Modals (focus trap + Esc + scroll lock) ---------- */
  var stack = [];
  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select,textarea,[tabindex]:not([tabindex="-1"])';

  function lockScroll() { document.documentElement.classList.toggle('no-scroll', stack.length > 0); }

  function openModal(el, opts) {
    opts = opts || {};
    if (!el.hidden) return;
    el.hidden = false;
    var entry = { el: el, returnTo: document.activeElement, onClose: opts.onClose };
    stack.push(entry);
    lockScroll();
    requestAnimationFrame(function () {
      el.classList.add('is-open');
      var target = opts.focus ? $(opts.focus, el) : $(FOCUSABLE, el.querySelector('.modal-card, .drawer-body, .chat-form') || el);
      if (target) target.focus({ preventScroll: true });
    });
  }

  function closeModal(el) {
    var idx = stack.findIndex(function (s) { return s.el === el; });
    if (idx === -1) return;
    var entry = stack.splice(idx, 1)[0];
    el.classList.remove('is-open');
    setTimeout(function () { el.hidden = true; }, 220);
    lockScroll();
    if (entry.onClose) entry.onClose();
    if (entry.returnTo && entry.returnTo.focus) entry.returnTo.focus({ preventScroll: true });
  }

  document.addEventListener('keydown', function (e) {
    var top = stack[stack.length - 1];
    if (!top) return;
    if (e.key === 'Escape') { e.preventDefault(); closeModal(top.el); return; }
    if (e.key === 'Tab') {
      var f = $$(FOCUSABLE, top.el).filter(function (n) { return n.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------- Confirm dialog (Promise-based) ---------- */
  function confirmBox(text, yesLabel) {
    return new Promise(function (resolve) {
      var m = $('#confirmModal'), yes = $('#confirmYes'), no = $('#confirmNo');
      $('#confirmText').textContent = text;
      yes.textContent = yesLabel || 'Yes, do it';
      var result = false;
      function done(v) { result = v; closeModal(m); }
      yes.onclick = function () { done(true); };
      no.onclick = function () { done(false); };
      openModal(m, { focus: '#confirmNo', onClose: function () { resolve(result); } });
    });
  }

  OMC.ui = {
    $: $, $$: $$, esc: esc, debounce: debounce, toast: toast,
    openModal: openModal, closeModal: closeModal, confirm: confirmBox,
    reducedMotion: reducedMotion, hasGsap: hasGsap,
    dietIcon: function (d) { return { veg: '🟢', chicken: '🍗', fish: '🐟', buff: '🐃', pork: '🐖', mix: '🍖' }[d] || '🍽️'; },
    dietLabel: function (d) { return { veg: 'Veg', chicken: 'Chicken', fish: 'Fish', buff: 'Buff', pork: 'Pork', mix: 'Mixed' }[d] || d; }
  };
})(window.OMC = window.OMC || {});
