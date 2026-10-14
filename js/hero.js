/* ==========================================================================
   Hero — giant pizza intro, wavy title warp, floating toppings,
   delivery rider, size guide and scroll reveals.
   GSAP drives the motion when available; CSS fallbacks keep it alive without.
   ========================================================================== */
(function (OMC) {
  'use strict';
  var ui = OMC.ui, $ = ui.$, $$ = ui.$$;
  var heroVisible = true;

  /* ---------- Pizzas ---------- */
  function renderPizzas() {
    $('#heroPizza').innerHTML = OMC.art.pizza({ seed: 22, id: 'hero' });
    $('#sizePreviewPizza').innerHTML = OMC.art.pizza({ seed: 9, id: 'size', diet: 'mix' });
    $('#findPizza').innerHTML = OMC.art.pizza({ seed: 4, id: 'find', diet: 'pork' });
  }

  function introPizza() {
    var pizza = $('#heroPizza'), sticker = $('#sizeSticker');
    if (!ui.hasGsap()) { pizza.classList.add('css-spin'); return; }
    var g = window.gsap;
    var tl = g.timeline({ defaults: { ease: 'power3.out' } });
    tl.from('.hero-in', { y: 28, opacity: 0, duration: .7, stagger: .09 })
      .from(pizza, { xPercent: 130, rotation: 240, scale: .6, duration: 1.4, ease: 'back.out(1.2)' }, 0.1)
      .from('.pizza-rings .ring', { scale: 0, opacity: 0, duration: .8, stagger: .12 }, 0.6)
      .from(sticker, { scale: 0, rotation: -90, duration: .6, ease: 'back.out(2.5)' }, 1.2)
      .add(function () {
        g.to(pizza, { rotation: '+=360', duration: 40, ease: 'none', repeat: -1 });
        g.to(sticker, { rotation: 8, y: -6, duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      });

    // Pointer tilt on the stage (desktop only)
    var stage = $('#heroStage');
    if (window.matchMedia('(hover: hover)').matches) {
      stage.addEventListener('pointermove', function (e) {
        var r = stage.getBoundingClientRect();
        var dx = (e.clientX - r.left) / r.width - .5, dy = (e.clientY - r.top) / r.height - .5;
        g.to(stage, { rotationY: dx * 14, rotationX: -dy * 14, duration: .6, ease: 'power2.out' });
      });
      stage.addEventListener('pointerleave', function () { g.to(stage, { rotationX: 0, rotationY: 0, duration: .8 }); });
    }
  }

  /* ---------- Wavy title: animate the textPath curves ---------- */
  function wavyTitle() {
    var p1 = $('#wave1'), p2 = $('#wave2');
    if (!p1 || ui.reducedMotion) return;
    function d(y, amp) { return 'M10 ' + y + ' Q 160 ' + (y - amp).toFixed(1) + ' 300 ' + y + ' T 590 ' + y; }
    var start = performance.now();
    (function frame(now) {
      if (heroVisible && !document.hidden) {
        var t = (now - start) / 1000;
        p1.setAttribute('d', d(95, Math.sin(t * 1.6) * 34));
        p2.setAttribute('d', d(205, Math.sin(t * 1.6 + Math.PI * .8) * 30));
      }
      requestAnimationFrame(frame);
    })(start);
  }

  /* ---------- Floating toppings ---------- */
  function floaters() {
    var layer = $('#toppingsLayer');
    var small = window.innerWidth < 640;
    var count = small ? 7 : 13;
    var html = '';
    for (var i = 0; i < count; i++) {
      var size = (small ? 20 : 26) + Math.round(Math.random() * (small ? 14 : 22));
      html += '<span class="floater" style="left:' + (Math.random() * 96).toFixed(1) + '%;top:' + (4 + Math.random() * 82).toFixed(1) +
              '%;width:' + size + 'px;height:' + size + 'px;--d:' + (4 + Math.random() * 4).toFixed(1) + 's;--delay:-' + (Math.random() * 4).toFixed(1) + 's" data-depth="' +
              (0.4 + Math.random()).toFixed(2) + '">' + OMC.art.FLOATERS[i % OMC.art.FLOATERS.length] + '</span>';
    }
    layer.innerHTML = html;
    if (!ui.hasGsap()) return; // CSS keyframes handle the bobbing

    var g = window.gsap, nodes = $$('.floater', layer);
    layer.classList.add('gsap-on');
    nodes.forEach(function (n) {
      g.fromTo(n, { opacity: 0, scale: 0 }, { opacity: .95, scale: 1, duration: .8, delay: 1 + Math.random(), ease: 'back.out(2)' });
      g.to(n, { y: '+=' + (14 + Math.random() * 22), rotation: (Math.random() - .5) * 90, duration: 2.5 + Math.random() * 2.5, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    });
    if (window.matchMedia('(hover: hover)').matches) {
      $('#hero').addEventListener('pointermove', function (e) {
        var dx = e.clientX / window.innerWidth - .5, dy = e.clientY / window.innerHeight - .5;
        nodes.forEach(function (n) {
          var k = +n.dataset.depth * 30;
          g.to(n, { x: -dx * k, marginTop: -dy * k, duration: 1, ease: 'power2.out', overwrite: 'auto' });
        });
      });
    }
  }

  /* ---------- Delivery rider ---------- */
  var riderTl;
  function rider() {
    var road = $('#road'), el = $('#rider');
    el.innerHTML = OMC.art.rider();
    if (!ui.hasGsap()) { el.classList.add('css-ride'); road.addEventListener('click', function () { el.classList.remove('css-ride'); void el.offsetWidth; el.classList.add('css-ride'); }); return; }

    var g = window.gsap, wheels = $$('.wheel', el);
    function build(fast) {
      if (riderTl) riderTl.kill();
      var w = road.offsetWidth, rw = el.offsetWidth;
      var dur = fast ? 1.6 : Math.max(3.2, w / 320);
      riderTl = g.timeline({ repeat: fast ? 0 : -1, repeatDelay: 2.2, onComplete: fast ? function () { build(false); } : null });
      riderTl.set(el, { x: -rw - 20 })
        .to(el, { x: w + 20, duration: dur, ease: fast ? 'power2.in' : 'power1.inOut' }, 0)
        .to(wheels, { rotation: fast ? 1440 : 1080, duration: dur, ease: 'none' }, 0)
        .to(el, { y: -3, duration: .12, yoyo: true, repeat: Math.round(dur / .12), ease: 'sine.inOut' }, 0)
        .to(el.querySelector('svg'), { rotation: fast ? -6 : -2, transformOrigin: '30% 90%', duration: .3, yoyo: true, repeat: 1 }, 0);
    }
    build(false);
    road.addEventListener('click', function () { build(true); });
    window.addEventListener('resize', ui.debounce(function () { build(false); }, 300));
  }

  /* ---------- Size guide ---------- */
  var SIZE_INFO = {
    S:  { inch: 12, note: 'Perfect solo pie — or a snack for two.' },
    M:  { inch: 15, note: 'Date night sorted.' },
    L:  { inch: 18, note: 'Feeds the family. Leftovers optional.' },
    XL: { inch: 22, note: 'The ultimate party pie. Bring the whole squad!' }
  };
  function sizeGuide() {
    var opts = $$('.size-opt'), pizza = $('#sizePreviewPizza'), note = $('#sizeNote');
    function select(btn) {
      opts.forEach(function (b) { b.setAttribute('aria-checked', b === btn ? 'true' : 'false'); });
      var info = SIZE_INFO[btn.dataset.size], scale = +btn.dataset.scale;
      var ratio = (info.inch * info.inch) / 144;
      note.innerHTML = 'A ' + info.inch + '" pizza = <b>' + ratio.toFixed(1) + '×</b> a 12". ' + info.note;
      if (ui.hasGsap()) window.gsap.to(pizza, { scale: scale, rotation: '+=' + 120, duration: .7, ease: 'back.out(1.6)' });
      else pizza.style.transform = 'scale(' + scale + ')';
    }
    opts.forEach(function (b, i) {
      b.addEventListener('click', function () { select(b); });
      b.addEventListener('keydown', function (e) {
        var dir = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -1 : 0;
        if (!dir) return;
        e.preventDefault();
        var next = opts[(i + dir + opts.length) % opts.length]; next.focus(); select(next);
      });
    });
    select(opts[3]);
  }

  /* ---------- Scroll reveal ---------- */
  function reveals() {
    var hero = $('#hero');
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) { heroVisible = e[0].isIntersecting; }).observe(hero);
    }
    var targets = $$('.section-head, .size-guide, .steps li, .find-grid > *, .card-row .food-card');
    if (!ui.hasGsap() || !('IntersectionObserver' in window)) return;
    targets.forEach(function (t) { t.classList.add('pre-reveal'); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        window.gsap.to(en.target, { opacity: 1, y: 0, rotation: 0, duration: .7, ease: 'back.out(1.4)', delay: (Array.prototype.indexOf.call(en.target.parentNode.children, en.target) % 4) * .08,
          onComplete: function () { en.target.classList.remove('pre-reveal'); en.target.style.transform = ''; } });
      });
    }, { threshold: .15 });
    targets.forEach(function (t) { io.observe(t); });
  }

  OMC.hero = {
    init: function () {
      renderPizzas();
      introPizza();
      wavyTitle();
      floaters();
      rider();
      sizeGuide();
    },
    reveals: reveals
  };
})(window.OMC = window.OMC || {});
