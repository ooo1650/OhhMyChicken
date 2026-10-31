/* ==========================================================================
   Home — hero card with the 3D pizza, categories, popular dishes, size guide, gallery,
   how ordering works, lunch & dinner, outlets and FAQ.
   ========================================================================== */
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useSite } from './store.jsx';
import { Link } from './router.jsx';
import { DishCard } from './Menu.jsx';
import { Gallery } from './Gallery.jsx';
import { FindUs } from './FindUs.jsx';
import { Icon } from '../shared/Icon.jsx';
import { Photo } from '../shared/Photo.jsx';
import { fmt12, reducedMotion } from '../shared/format.js';
import { faqs, meals, servicesText, hoursText, categoryPath } from '../shared/seo.js';
import { outletList } from '../shared/outlets.js';
import { track } from '../shared/track.js';
import slice760 from '../assets/hero-slice-760.webp';
import slice1400 from '../assets/hero-slice-1400.webp';
import pizza480 from '../assets/hero-pizza-480.webp';
import pizza900 from '../assets/hero-pizza-900.webp';

/* ---------- Hero ---------- */
// Embers rising from the furnace: [left %, size px, duration s, delay s].
const EMBERS = [[6, 3, 7, 0], [14, 4, 9, 3], [23, 2, 6, 1.5], [31, 3, 8, 5], [39, 4, 10, 2], [47, 2, 6.5, 4], [55, 3, 8.5, .5], [63, 4, 7.5, 3.5], [71, 2, 9.5, 6], [79, 3, 7, 2.5], [87, 4, 8, 4.5], [94, 2, 6, 1]];

function Furnace() {
  return (
    <div className="hero-fire" aria-hidden="true">
      <span className="fire-glow" />
      {EMBERS.map(([left, size, dur, delay]) => (
        <i key={left} style={{ left: left + '%', width: size, height: size, animationDuration: dur + 's', animationDelay: -delay + 's' }} />
      ))}
    </div>
  );
}

function Hero({ active }) {
  const site = useSite(), s = site.settings;
  const [broken, setBroken] = useState(false);
  const photo = broken ? null : site.hero;
  const outlets = outletList(s).length;
  const rootRef = useRef(null);
  // The home view stays mounted behind other pages: only fetch its images once it has been opened.
  const opened = useRef(active);
  if (active) opened.current = true;

  // The fire rests while the hero is off screen.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || reducedMotion || !('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver((en) => el.classList.toggle('is-resting', !en[0].isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const pizzas = site.menu.filter((m) => m.isPizza && m.available).flatMap((m) => m.prices.map((p) => +p.price));
  return (
    <div className="hero-shell">
      <div className={'hero' + (photo ? ' has-photo' : '')} id="hero" ref={rootRef}>
        {photo && opened.current && <Photo media={photo} alt="" sizes="100vw" eager fetchPriority="high" className="hero-photo" onFail={() => setBroken(true)} />}
        {!photo && <Furnace />}
        {/* The pizza is mirrored in CSS, and breaks out of the card. */}
        {!photo && opened.current && (
          <img className="hero-slice" src={slice1400} srcSet={slice760 + ' 760w, ' + slice1400 + ' 1400w'}
            sizes="(max-width: 859px) 110vw, 1000px" width="1400" height="636" alt="" decoding="async" fetchPriority="high" />
        )}
        <div className="hero-copy">
          {/* The visible H1 is the name; the rest carries the search keywords. */}
          <h1 className="hero-title">Ohh! My Chicken <span>Pizza Hub</span><span className="sr-only">: pizza restaurant in {s.city}</span></h1>
          <p className="hero-tag">Giant pizzas, crispy fried chicken and MoMo, made fresh to order. Dine in, or get it delivered.</p>
          <div className="hero-ctas">
            <Link to="/menu" className="btn btn-red btn-lg">Order online <Icon name="arrow-right" /></Link>
            <Link to="/menu" className="btn btn-ghost btn-lg">View menu</Link>
          </div>
        </div>
        {/* Stats sit in a notch cut out of the card's bottom-left corner. */}
        <ul className="hero-stats">
          <li><b>{site.menu.length}</b><span>Dishes</span></li>
          {pizzas.length > 0 && <li><b>{site.money(Math.min(...pizzas))}</b><span>Pizzas from</span></li>}
          {outlets > 1 && <li><b>{outlets}</b><span>Outlets</span></li>}
          <li className={site.isOpen ? 'is-open' : undefined}><b>{fmt12(site.isOpen ? s.hoursClose : s.hoursOpen)}</b><span>{site.isOpen ? 'Open until' : 'Opens at'}</span></li>
        </ul>
      </div>
    </div>
  );
}

/* ---------- Jump straight to a category ---------- */
function Categories() {
  const { categories, menu } = useSite();
  const list = categories.map((c) => ({ c, n: menu.filter((m) => m.category === c.id).length })).filter((x) => x.n);
  return (
    <nav className="wrap cat-tiles" aria-label="Menu categories">
      {list.map(({ c, n }) => (
        <Link key={c.id} to={categoryPath(c)} className="cat-tile">
          <Icon name={c.icon} /><b>{c.short}</b><small>{n} items</small>
        </Link>
      ))}
    </nav>
  );
}

/* ---------- Size guide ---------- */
const SIZES = [
  { key: 'S', inch: 12, name: 'Small', who: '1–2 people', note: 'A good size for one, or a snack for two.' },
  { key: 'M', inch: 15, name: 'Medium', who: '2–3 people', note: 'Right for a couple or a small lunch.' },
  { key: 'L', inch: 18, name: 'Large', who: '4–5 people', note: 'Feeds a family.' },
  { key: 'XL', inch: 22, name: 'Extra Large', who: '6–8 people', note: 'Made for parties and big tables.' }
];

function SizeGuide() {
  const [sel, setSel] = useState(3);
  const btns = useRef([]);
  const info = SIZES[sel], ratio = (info.inch * info.inch) / 144;

  const onKey = (e, i) => {
    const dir = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (i + dir + SIZES.length) % SIZES.length;
    btns.current[next].focus();
    setSel(next);
  };

  return (
    <section className="section section-soft" id="sizes" aria-labelledby="sizesTitle">
      <div className="wrap">
        <div className="section-head">
          <h2 className="sec-title" id="sizesTitle">Which size do you need?</h2>
        </div>
        <div className="size-guide">
          {/* The pizza and rings are to scale, so the jump to 22" is easy to see. */}
          <div className="size-visual" aria-hidden="true">
            <svg className="size-rings" viewBox="0 0 220 220" focusable="false">
              {SIZES.map((z) => <circle key={z.key} cx="110" cy="110" r={z.inch * 5 - 1} className={z.key === info.key ? 'on' : undefined} />)}
            </svg>
            <img className="size-pizza" src={pizza480} srcSet={pizza480 + ' 480w, ' + pizza900 + ' 900w'} sizes="(max-width: 600px) 200px, 340px"
              width="900" height="900" alt="" loading="lazy" decoding="async" style={{ transform: 'scale(' + (info.inch / 22).toFixed(3) + ')' }} />
            <span className="size-tag"><b>{info.inch}"</b> {info.name}</span>
          </div>
          <div className="size-options" role="radiogroup" aria-label="Pizza size">
            {SIZES.map((z, i) => (
              <button key={z.key} ref={(el) => { btns.current[i] = el; }} className="size-opt"
                role="radio" aria-checked={i === sel} onClick={() => { setSel(i); track('size_select', { value: z.key }); }} onKeyDown={(e) => onKey(e, i)}>
                <b>{z.inch}"</b><span>{z.name}</span><em>{z.who}</em>
              </button>
            ))}
          </div>
        </div>
        <p className="size-note">{info.inch > 12 && <>A {info.inch}" pizza is <b>{ratio.toFixed(1)}×</b> the size of a 12". </>}{info.note}</p>
      </div>
    </section>
  );
}

/* ---------- Lunch, dinner & delivery (what the restaurant offers, from settings) ---------- */
function Meals() {
  const site = useSite(), s = site.settings, m = meals(s);
  const services = servicesText(s);
  return (
    <section className="section section-soft meals" aria-labelledby="mealsTitle">
      <div className="wrap">
        <div className="section-head">
          <h2 className="sec-title" id="mealsTitle">Pizza restaurant <span className="hl">in {s.city}</span></h2>
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
      </div>
    </section>
  );
}

/* ---------- FAQ (same questions as the FAQPage structured data) ---------- */
function Faq() {
  const site = useSite();
  const list = faqs({ defaults: site.defaults, menu: site.menu, settings: site.settings });
  return (
    <section className="section section-soft" aria-labelledby="faqTitle">
      <div className="wrap faq-wrap">
        <div className="section-head">
          <h2 className="sec-title" id="faqTitle">Frequently asked questions</h2>
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

  // Sections fade in as they scroll into view.
  useEffect(() => {
    if (reducedMotion || !('IntersectionObserver' in window)) return undefined;
    const targets = rootRef.current.querySelectorAll('.section-head, .size-guide, .steps li, .find-copy, .find-map, .branch');
    targets.forEach((t) => t.classList.add('pre-reveal'));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        gsap.to(en.target, {
          opacity: 1, y: 0, duration: 0.5, ease: 'power2.out',
          onComplete: () => { en.target.classList.remove('pre-reveal'); en.target.style.transform = ''; }
        });
      });
    }, { threshold: 0.15 });
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);

  return (
    <section className="view" id="view-home" ref={rootRef} hidden={!active}>
      <Hero active={active} />
      <Categories />

      <section className="section section-light" aria-labelledby="specialsTitle">
        <div className="wrap">
          <div className="section-head section-head-row">
            <h2 className="sec-title" id="specialsTitle">Customer favourites</h2>
            <Link to="/menu" className="more-link">See the full menu <Icon name="arrow-right" /></Link>
          </div>
          <div className="card-row">{picks.map((i) => <DishCard key={i.id} item={i} q="" />)}</div>
        </div>
      </section>

      <SizeGuide />
      <Gallery />

      <section className="section section-light" aria-labelledby="howTitle">
        <div className="wrap">
          <h2 className="sec-title" id="howTitle">How ordering works</h2>
          <ol className="steps">
            <li><span className="step-ico"><Icon name="phone-app" /></span><b>Choose</b><p>Browse the menu and pick your size.</p></li>
            <li><span className="step-ico"><Icon name="whatsapp" /></span><b>Send</b><p>Your order opens in WhatsApp at the outlet you pick.</p></li>
            <li><span className="step-ico"><Icon name="bike" /></span><b>Enjoy</b><p>Delivered hot in about {s.deliveryMins} minutes, or served at your table.</p></li>
          </ol>
        </div>
      </section>

      <Meals />
      <FindUs />
      <Faq />
    </section>
  );
}
