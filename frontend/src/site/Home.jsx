/* ==========================================================================
   Home — wavy title, the giant drawn pizza, size guide and popular picks.
   Nothing here moves.
   ========================================================================== */
import { Fragment, useMemo, useRef, useState } from 'react';
import { useSite } from './store.jsx';
import { Link } from './router.jsx';
import { Art, iconFor, pizza } from './art.jsx';
import { Photo } from '../shared/Photo.jsx';
import { Gallery } from './Gallery.jsx';
import { FindUs } from './FindUs.jsx';
import { Icon } from '../shared/Icon.jsx';
import { fmt12 } from '../shared/format.js';
import { categoryPath, deliveryRange, faqs, meals, servicesText, hoursText } from '../shared/seo.js';
import { track } from '../shared/track.js';

/* ---------- Hero ---------- */
function Hero() {
  const { settings, menu } = useSite();
  const heroPizza = useMemo(() => pizza({ seed: 22, id: 'hero' }), []);

  return (
    <div className="hero" id="hero">
      <div className="hero-dots" aria-hidden="true" />

      <div className="wrap hero-grid">
        <div className="hero-copy">
          <p className="eyebrow hero-h1"><Icon name="flame" /> Pizza restaurant in {settings.city} · Home of the GIANT 22" pizza</p>

          <h1 className="wavy-title">
            <span className="sr-only">Ohh My Chicken Pizza Hub</span>
            <svg viewBox="0 0 760 232" className="wavy-svg" aria-hidden="true" focusable="false">
              <defs>
                <path id="wave1" d="M8 104 Q 190 88 380 104 T 752 104" />
                <path id="wave2" d="M8 212 Q 190 196 380 212 T 752 212" />
              </defs>
              <text className="wt-shadow"><textPath href="#wave1">Ohh My Chicken</textPath></text>
              <text className="wt-main wt-2"><textPath href="#wave1">Ohh My Chicken</textPath></text>
              <text className="wt-shadow"><textPath href="#wave2">Pizza Hub</textPath></text>
              <text className="wt-main wt-1"><textPath href="#wave2">Pizza Hub</textPath></text>
            </svg>
          </h1>

          <p className="hero-claim">The largest pizza in town</p>
          <p className="hero-tag">Pizzas so big they need their own seat. <strong>Crispy chicken</strong> so good you'll say it out loud.</p>

          <div className="hero-ctas">
            <Link to="/menu" className="btn btn-yellow btn-lg">
              Order Online
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </Link>
            <Link to="/menu" className="btn btn-ghost btn-lg">View Menu</Link>
          </div>

          <ul className="hero-stats">
            <li><b>22"</b><span>XL pizza</span></li>
            <li><b>{menu.length}</b><span>menu items</span></li>
          </ul>
        </div>

        <div className="hero-stage">
          <div className="pizza-rings" aria-hidden="true">
            <span className="ring r-xl" /><span className="ring r-l" /><span className="ring r-m" />
          </div>
          <Art className="hero-pizza" role="img" aria-label="A giant 22 inch pizza" html={heroPizza} />
          <div className="size-sticker">
            <span className="ss-num">22"</span>
            <span className="ss-txt">XL<br />GIANT</span>
          </div>
        </div>
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
  const btns = useRef([]);
  const art = useMemo(() => pizza({ seed: 9, id: 'size', diet: 'mix' }), []);
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
    <section className="section section-light" id="sizes" aria-labelledby="sizesTitle">
      <div className="wrap">
        <div className="section-head">
          <p className="eyebrow eyebrow-red">Pick your power level</p>
          <h2 className="tilt-title" id="sizesTitle"><span>How hungry</span> <span className="hl">are you?</span></h2>
        </div>
        <div className="size-guide">
          <div className="size-preview" aria-hidden="true">
            <Art className="size-preview-pizza" style={{ transform: 'scale(' + info.scale + ')' }} html={art} />
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
            <p>Pizza delivery across {s.city}, hot from the oven. Delivery fee {deliveryRange(s)}.</p></li>
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

/* ---------- A crowd favourite: the pizza, its name and starting price; opens its menu section ---------- */
function Pick({ item }) {
  const site = useSite();
  const art = useMemo(() => (item.image ? '' : iconFor(item)), [item]);
  const cat = site.categories.find((c) => c.id === item.category);
  return (
    <Link to={cat ? categoryPath(cat) : '/menu'} className="pick">
      {item.image
        ? <span className="pick-art"><Photo media={item.image} alt={item.image.alt || item.name} sizes="220px" /></span>
        : <Art as="span" className="pick-art" html={art} />}
      <span className="pick-name">{item.name}</span>
      <span className="pick-price">From {site.money(Math.min(...item.prices.map((p) => p.price)))}</span>
    </Link>
  );
}

/* ---------- Home view ---------- */
export function HomeView() {
  const site = useSite(), s = site.settings;
  const picks = site.menu.filter((m) => m.popular && m.available).slice(0, 4);

  return (
    <section className="view" id="view-home">
      <Hero />

      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[0, 1].map((k) => ['LARGEST PIZZA IN TOWN', 'GIANT 22" PIZZA', 'CRISPY FRIED CHICKEN', 'HOT WINGS', 'STEAM & FRIED MOMO', 'CHEESE FRIES'].map((t) => (
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
          <ul className="picks">{picks.map((i) => <li key={i.id}><Pick item={i} /></li>)}</ul>
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
            <li><span className="step-ico"><Icon name="bike" /></span><b>We zoom</b><p>Delivered hot to your door.</p></li>
          </ol>
        </div>
      </section>

      <Meals />

      <FindUs />

      <Faq />
    </section>
  );
}
