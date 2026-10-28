/* ==========================================================================
   Home — giant pizza intro, wavy title warp, floating toppings, delivery
   rider, size guide, popular picks and scroll reveals.
   GSAP drives the motion; CSS fallbacks run when reduced motion is on.
   ========================================================================== */
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { useSite } from './store.jsx';
import { Link } from './router.jsx';
import { Art, pizza, rider as riderSvg, WHEELS, FLOATERS } from './art.jsx';
import { DishCard } from './Menu.jsx';
import { Gallery } from './Gallery.jsx';
import { FindUs } from './FindUs.jsx';
import { Icon } from '../shared/Icon.jsx';
import { fmt12, reducedMotion } from '../shared/format.js';
import { faqs, meals, servicesText, hoursText } from '../shared/seo.js';
import { track } from '../shared/track.js';

const hover = () => window.matchMedia('(hover: hover)').matches;

function makeFloaters() {
  const small = window.innerWidth < 640, count = small ? 7 : 13, out = [];
  for (let i = 0; i < count; i++) {
    const size = (small ? 20 : 26) + Math.round(Math.random() * (small ? 14 : 22));
    out.push({
      style: { left: (Math.random() * 96).toFixed(1) + '%', top: (4 + Math.random() * 82).toFixed(1) + '%', width: size, height: size,
        '--d': (4 + Math.random() * 4).toFixed(1) + 's', '--delay': '-' + (Math.random() * 4).toFixed(1) + 's' },
      depth: (0.4 + Math.random()).toFixed(2),
      html: FLOATERS[i % FLOATERS.length]
    });
  }
  return out;
}

/* ---------- Hero ---------- */
function Hero() {
  const { settings, menu } = useSite();
  const heroRef = useRef(null), stageRef = useRef(null), pizzaRef = useRef(null), stickerRef = useRef(null);
  const wave1 = useRef(null), wave2 = useRef(null), layerRef = useRef(null), roadRef = useRef(null), riderRef = useRef(null);
  const [floaters] = useState(makeFloaters);
  const heroPizza = useMemo(() => pizza({ seed: 22, id: 'hero' }), []);
  const riderHtml = useMemo(() => riderSvg(), []);
  const [cssRide, setCssRide] = useState(0); // restarts the CSS ride animation

  // Intro, pointer tilt, floaters and rider (GSAP)
  useEffect(() => {
    if (reducedMotion) return undefined;
    const pz = pizzaRef.current, sticker = stickerRef.current, stage = stageRef.current, hero = heroRef.current;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('.hero-in', { y: 28, opacity: 0, duration: 0.7, stagger: 0.09 })
        .from(pz, { xPercent: 130, rotation: 240, scale: 0.6, duration: 1.4, ease: 'back.out(1.2)' }, 0.1)
        .from('.pizza-rings .ring', { scale: 0, opacity: 0, duration: 0.8, stagger: 0.12 }, 0.6)
        .from(sticker, { scale: 0, rotation: -90, duration: 0.6, ease: 'back.out(2.5)' }, 1.2)
        .add(() => {
          gsap.to(pz, { rotation: '+=360', duration: 40, ease: 'none', repeat: -1 });
          gsap.to(sticker, { rotation: 8, y: -6, duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut' });
        });

      layerRef.current.querySelectorAll('.floater').forEach((n) => {
        gsap.fromTo(n, { opacity: 0, scale: 0 }, { opacity: 0.95, scale: 1, duration: 0.8, delay: 1 + Math.random(), ease: 'back.out(2)' });
        gsap.to(n, { y: '+=' + (14 + Math.random() * 22), rotation: (Math.random() - 0.5) * 90, duration: 2.5 + Math.random() * 2.5, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      });
    }, hero);

    const cleanups = [];
    if (hover()) {
      const tilt = (e) => {
        const r = stage.getBoundingClientRect();
        const dx = (e.clientX - r.left) / r.width - 0.5, dy = (e.clientY - r.top) / r.height - 0.5;
        gsap.to(stage, { rotationY: dx * 14, rotationX: -dy * 14, duration: 0.6, ease: 'power2.out' });
      };
      const untilt = () => gsap.to(stage, { rotationX: 0, rotationY: 0, duration: 0.8 });
      const nodes = [...layerRef.current.querySelectorAll('.floater')];
      const parallax = (e) => {
        const dx = e.clientX / window.innerWidth - 0.5, dy = e.clientY / window.innerHeight - 0.5;
        nodes.forEach((n) => {
          const k = +n.dataset.depth * 30;
          gsap.to(n, { x: -dx * k, marginTop: -dy * k, duration: 1, ease: 'power2.out', overwrite: 'auto' });
        });
      };
      stage.addEventListener('pointermove', tilt);
      stage.addEventListener('pointerleave', untilt);
      hero.addEventListener('pointermove', parallax);
      cleanups.push(() => { stage.removeEventListener('pointermove', tilt); stage.removeEventListener('pointerleave', untilt); hero.removeEventListener('pointermove', parallax); });
    }

    // Delivery rider: the ride across the road is one timeline; the moving
    // parts (wheels, suspension, box, scarf, exhaust, headlight) loop on their
    // own, and an express run (tap the road) just plays them faster.
    // svgOrigin pins each rotation to a point in the drawing's own coordinates,
    // so the wheels always spin on their axles whatever the size.
    const road = roadRef.current, el = riderRef.current;
    const $ = (sel) => el.querySelectorAll(sel);
    const loops = [
      gsap.to(el.querySelector('.wheel-back'), { rotation: 360, svgOrigin: WHEELS.back.join(' '), duration: 0.45, ease: 'none', repeat: -1 }),
      gsap.to(el.querySelector('.wheel-front'), { rotation: 360, svgOrigin: WHEELS.front.join(' '), duration: 0.45, ease: 'none', repeat: -1 }),
      gsap.to($('.rider-body'), { y: -2.2, duration: 0.17, ease: 'sine.inOut', yoyo: true, repeat: -1 }),
      gsap.fromTo($('.box'), { rotation: -1.5 }, { rotation: 2, svgOrigin: '58 83', duration: 0.34, ease: 'sine.inOut', yoyo: true, repeat: -1 }),
      gsap.fromTo($('.scarf'), { scaleY: 1, skewX: 0 }, { scaleY: 0.72, skewX: -10, svgOrigin: '106 49', duration: 0.13, ease: 'sine.inOut', yoyo: true, repeat: -1 }),
      gsap.fromTo($('.beam'), { opacity: 0.32 }, { opacity: 0.14, duration: 0.6, ease: 'sine.inOut', yoyo: true, repeat: -1 }),
      gsap.fromTo($('.speed line'), { x: 0, opacity: 1 }, { x: -12, opacity: 0.25, duration: 0.22, ease: 'none', yoyo: true, repeat: -1, stagger: 0.07 }),
      ...[...$('.puff')].map((p, i) => gsap.fromTo(p,
        { x: 0, y: 0, scale: 0.4, opacity: 0.95 },
        { x: -36, y: -8 - i * 3, scale: 1.7, opacity: 0, transformOrigin: '50% 50%', duration: 0.8, ease: 'power1.out', repeat: -1, delay: i * 0.27 }))
    ];
    const speed = (k) => loops.forEach((t) => t.timeScale(k));
    let riderTl;
    function build(fast) {
      if (riderTl) riderTl.kill();
      const w = road.offsetWidth, rw = el.offsetWidth;
      const dur = fast ? 1.6 : Math.max(3.2, w / 320);
      speed(fast ? 2.6 : 1);
      riderTl = gsap.timeline({ repeat: fast ? 0 : -1, repeatDelay: 2.2, onComplete: fast ? () => build(false) : null });
      riderTl.set(el, { x: -rw - 20 })
        .to(el, { x: w + 20, duration: dur, ease: fast ? 'power2.in' : 'power1.inOut' }, 0)
        // lean back when pulling away
        .to(el.querySelector('svg'), { rotation: fast ? -6 : -2, transformOrigin: '30% 90%', duration: 0.3, yoyo: true, repeat: 1 }, 0);
    }
    build(false);
    const zoom = () => build(true);
    let rt;
    const onResize = () => { clearTimeout(rt); rt = setTimeout(() => build(false), 300); };
    road.addEventListener('click', zoom);
    window.addEventListener('resize', onResize);
    cleanups.push(() => { road.removeEventListener('click', zoom); window.removeEventListener('resize', onResize); clearTimeout(rt); if (riderTl) riderTl.kill(); loops.forEach((t) => t.kill()); });

    return () => { cleanups.forEach((f) => f()); ctx.revert(); };
  }, []);

  // Wavy title: animate the textPath curves while the hero is on screen.
  useEffect(() => {
    if (reducedMotion) return undefined;
    let visible = true, raf;
    const io = 'IntersectionObserver' in window ? new IntersectionObserver((e) => { visible = e[0].isIntersecting; }) : null;
    if (io) io.observe(heroRef.current);
    const d = (y, amp) => 'M10 ' + y + ' Q 160 ' + (y - amp).toFixed(1) + ' 300 ' + y + ' T 590 ' + y;
    const start = performance.now();
    const frame = (now) => {
      if (visible && !document.hidden) {
        const t = (now - start) / 1000;
        wave1.current.setAttribute('d', d(95, Math.sin(t * 1.6) * 34));
        wave2.current.setAttribute('d', d(205, Math.sin(t * 1.6 + Math.PI * 0.8) * 30));
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); if (io) io.disconnect(); };
  }, []);

  return (
    <div className="hero" id="hero" ref={heroRef}>
      <div className="hero-dots" aria-hidden="true" />
      <div className={'toppings-layer' + (reducedMotion ? '' : ' gsap-on')} ref={layerRef} aria-hidden="true">
        {floaters.map((f, i) => <Art key={i} as="span" className="floater" style={f.style} data-depth={f.depth} html={f.html} />)}
      </div>

      <div className="wrap hero-grid">
        <div className="hero-copy">
          {/* The visible H1 carries the search keywords; the wavy logo below is a picture. */}
          <h1 className="eyebrow hero-in hero-h1"><Icon name="flame" /> Pizza restaurant in {settings.city} · Home of the GIANT 22" pizza</h1>

          <div className="wavy-title hero-in" role="img" aria-label={settings.name}>
            <svg viewBox="0 0 600 250" className="wavy-svg" aria-hidden="true" focusable="false">
              <defs>
                <path id="wave1" ref={wave1} d="M10 95 Q 160 45 300 95 T 590 95" />
                <path id="wave2" ref={wave2} d="M10 205 Q 160 155 300 205 T 590 205" />
              </defs>
              <text className="wt-shadow"><textPath href="#wave1" startOffset="2%">Ohh My</textPath></text>
              <text className="wt-main wt-1"><textPath href="#wave1" startOffset="2%">Ohh My</textPath></text>
              <text className="wt-shadow"><textPath href="#wave2" startOffset="1%">Chicken!</textPath></text>
              <text className="wt-main wt-2"><textPath href="#wave2" startOffset="1%">Chicken!</textPath></text>
            </svg>
          </div>

          <p className="hero-tag hero-in">Pizzas so big they need their own seat. <strong>Crispy chicken</strong> so good you'll say it out loud.</p>

          <div className="hero-ctas hero-in">
            <Link to="/menu" className="btn btn-yellow btn-lg">
              Order Online
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </Link>
            <Link to="/menu" className="btn btn-ghost btn-lg">View Menu</Link>
          </div>

          <ul className="hero-stats hero-in">
            <li><b>22"</b><span>XL pizza</span></li>
            <li><b>{settings.deliveryMins}</b><span>min delivery</span></li>
            <li><b>{menu.length}</b><span>menu items</span></li>
          </ul>
        </div>

        <div className="hero-stage" ref={stageRef}>
          <div className="pizza-rings" aria-hidden="true">
            <span className="ring r-xl" /><span className="ring r-l" /><span className="ring r-m" />
          </div>
          <Art className={'pizza-spin' + (reducedMotion ? ' css-spin' : '')} ref={pizzaRef} role="img" aria-label="A giant 22 inch pizza rotating" html={heroPizza} />
          <div className="size-sticker" ref={stickerRef}>
            <span className="ss-num">22"</span>
            <span className="ss-txt">XL<br />GIANT</span>
          </div>
          <div className="steam" aria-hidden="true"><i /><i /><i /></div>
        </div>
      </div>

      {/* Delivery road */}
      <div className="road" ref={roadRef} title="Tap for another delivery!" onClick={reducedMotion ? () => setCssRide((n) => n + 1) : undefined}>
        <div className="road-lines" aria-hidden="true" />
        <Art key={cssRide} className={'rider' + (reducedMotion ? ' css-ride' : '')} ref={riderRef} aria-hidden="true" html={riderHtml} />
        <span className="road-label"><Icon name="bike" /> Hot &amp; fast delivery — tap the road!</span>
      </div>
    </div>
  );
}

/* ---------- Size guide ---------- */
const SIZES = [
  { key: 'S', inch: 12, scale: 0.55, name: 'Small', who: '1–2 people', note: 'Perfect solo pie — or a snack for two.' },
  { key: 'M', inch: 15, scale: 0.68, name: 'Medium', who: '2–3 people', note: 'Date night sorted.' },
  { key: 'L', inch: 18, scale: 0.82, name: 'Large', who: '4–5 people', note: 'Feeds the family. Leftovers optional.' },
  { key: 'XL', inch: 22, scale: 1, name: 'Extra Large', who: '6–8 people · parties!', note: 'The ultimate party pie. Bring the whole squad!' }
];

function SizeGuide() {
  const [sel, setSel] = useState(3);
  const pizzaRef = useRef(null), btns = useRef([]);
  const art = useMemo(() => pizza({ seed: 9, id: 'size', diet: 'mix' }), []);
  const info = SIZES[sel], ratio = (info.inch * info.inch) / 144;

  useEffect(() => {
    if (reducedMotion) pizzaRef.current.style.transform = 'scale(' + SIZES[sel].scale + ')';
    else gsap.to(pizzaRef.current, { scale: SIZES[sel].scale, rotation: '+=' + 120, duration: 0.7, ease: 'back.out(1.6)' });
  }, [sel]);

  const onKey = (e, i) => {
    const dir = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (i + dir + SIZES.length) % SIZES.length;
    btns.current[next].focus();
    setSel(next);
  };

  return (
    <section className="section section-light" id="sizes" aria-labelledby="sizesTitle">
      <div className="wrap">
        <div className="section-head">
          <p className="eyebrow eyebrow-red">Pick your power level</p>
          <h2 className="tilt-title" id="sizesTitle"><span>How hungry</span> <span className="hl">are you?</span></h2>
        </div>
        <div className="size-guide">
          <div className="size-preview" aria-hidden="true">
            <Art className="size-preview-pizza" ref={pizzaRef} html={art} />
          </div>
          <div className="size-options" role="radiogroup" aria-label="Pizza size">
            {SIZES.map((s, i) => (
              <button key={s.key} ref={(el) => { btns.current[i] = el; }} className={'size-opt' + (s.key === 'XL' ? ' is-xl' : '')}
                role="radio" aria-checked={i === sel} onClick={() => { setSel(i); track('size_select', { value: s.key }); }} onKeyDown={(e) => onKey(e, i)}>
                <b>{s.inch}"</b><span>{s.name}</span><em>{s.who}</em>
              </button>
            ))}
          </div>
        </div>
        <p className="size-note">A {info.inch}" pizza = <b>{ratio.toFixed(1)}×</b> a 12". {info.note}</p>
      </div>
    </section>
  );
}

/* ---------- Lunch, dinner & delivery (what the restaurant offers, from settings) ---------- */
function Meals() {
  const site = useSite(), s = site.settings, m = meals(s);
  const services = servicesText(s);
  return (
    <section className="section section-light meals" aria-labelledby="mealsTitle">
      <div className="wrap">
        <div className="section-head">
          <p className="eyebrow eyebrow-red">{['Lunch', 'Dinner', 'Delivery'].filter((w) => w === 'Delivery' || m.includes(w.toLowerCase())).join(' · ')}</p>
          <h2 className="tilt-title" id="mealsTitle"><span>Pizza restaurant</span> <span className="hl">in {s.city}</span></h2>
          <p className="meals-lead">
            {s.name} is a pizza and fried chicken restaurant in {s.city}. {services.charAt(0).toUpperCase() + services.slice(1)}
            {m.length ? ' for ' + m.join(' or ') : ''}: giant 22" pizzas for the whole table, crispy fried chicken, hot wings and MoMo,
            cooked fresh to order. Open every day, {hoursText(s)}.
          </p>
        </div>
        <ul className="meal-cards">
          {m.includes('lunch') && (
            <li><span className="step-ico"><Icon name="clock" /></span><h3>Lunch</h3>
              <p>A 12" pizza for one, a chicken combo or a plate of MoMo for your lunch break.</p></li>
          )}
          {m.includes('dinner') && (
            <li><span className="step-ico"><Icon name="utensils" /></span><h3>Dinner</h3>
              <p>Family dinner or a night with friends: an 18" Large feeds 4–5, the 22" XL feeds 6–8.</p></li>
          )}
          <li><span className="step-ico"><Icon name="bike" /></span><h3>Delivery</h3>
            <p>Pizza delivery across {s.city} in about {s.deliveryMins} minutes{s.freeDeliveryOver ? ', free over ' + site.money(s.freeDeliveryOver) : ''}.</p></li>
        </ul>
        <div className="center mt"><Link to="/menu" className="btn btn-red">See the menu &amp; prices</Link></div>
      </div>
    </section>
  );
}

/* ---------- FAQ (same questions as the FAQPage structured data) ---------- */
function Faq() {
  const site = useSite();
  const list = faqs({ defaults: site.defaults, menu: site.menu, settings: site.settings });
  return (
    <section className="section section-yellow" aria-labelledby="faqTitle">
      <div className="wrap faq-wrap">
        <div className="section-head">
          <h2 className="tilt-title" id="faqTitle"><span>Questions?</span> <span className="hl-red">Answers.</span></h2>
        </div>
        <div className="faq-list">
          {list.map((f, i) => (
            <details key={f.q} open={i === 0}>
              <summary><h3>{f.q}</h3></summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Home view ---------- */
export function HomeView({ active }) {
  const site = useSite(), s = site.settings;
  const rootRef = useRef(null);
  const picks = site.menu.filter((m) => m.popular && m.available).slice(0, 8);

  // Scroll reveals
  useEffect(() => {
    if (reducedMotion || !('IntersectionObserver' in window)) return undefined;
    const targets = rootRef.current.querySelectorAll('.section-head, .size-guide, .steps li, .find-copy, .find-map, .branch');
    targets.forEach((t) => t.classList.add('pre-reveal'));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        gsap.to(en.target, {
          opacity: 1, y: 0, rotation: 0, duration: 0.7, ease: 'back.out(1.4)',
          delay: ([...en.target.parentNode.children].indexOf(en.target) % 4) * 0.08,
          onComplete: () => { en.target.classList.remove('pre-reveal'); en.target.style.transform = ''; }
        });
      });
    }, { threshold: 0.15 });
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);

  return (
    <section className="view" id="view-home" ref={rootRef} hidden={!active}>
      <Hero />

      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[0, 1].map((k) => ['GIANT 22" PIZZA', 'CRISPY FRIED CHICKEN', 'HOT WINGS', 'STEAM & FRIED MOMO', 'CHEESE FRIES'].map((t) => (
            <Fragment key={k + t}><span>{t}</span><span className="mq-dot" /></Fragment>
          )))}
        </div>
      </div>

      <SizeGuide />

      <section className="section section-dark" aria-labelledby="specialsTitle">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">Crowd favourites</p>
            <h2 className="tilt-title" id="specialsTitle"><span>OHH!!!</span> <span className="hl">My Picks</span></h2>
          </div>
          <div className="card-row">{picks.map((i) => <DishCard key={i.id} item={i} q="" />)}</div>
          <div className="center mt"><Link to="/menu" className="btn btn-red">See the full menu</Link></div>
        </div>
      </section>

      <Gallery />

      <section className="section section-yellow" aria-labelledby="howTitle">
        <div className="wrap">
          <h2 className="tilt-title center" id="howTitle"><span>Hot to your door</span> <span className="hl-red">in 3 steps</span></h2>
          <ol className="steps">
            <li><span className="step-ico"><Icon name="phone-app" /></span><b>Pick</b><p>Browse the menu &amp; choose your size.</p></li>
            <li><span className="step-ico"><Icon name="flame" /></span><b>We bake</b><p>Stone-baked &amp; fried fresh to order.</p></li>
            <li><span className="step-ico"><Icon name="bike" /></span><b>We zoom</b><p>Delivered hot in about {s.deliveryMins} minutes.</p></li>
          </ol>
        </div>
      </section>

      <Meals />

      <FindUs />

      <Faq />
    </section>
  );
}
