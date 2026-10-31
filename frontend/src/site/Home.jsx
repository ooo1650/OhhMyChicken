/* ==========================================================================
   Home — wavy title, the giant drawn pizza, size guide and popular picks.
   Nothing here moves.
   ========================================================================== */
import { Fragment, useMemo, useRef, useState } from 'react';
import { useSite } from './store.jsx';
import { Link } from './router.jsx';
import { Art, iconFor, pizza } from './art.jsx';
import { artKey } from '../shared/food-art.js';
import { useToast } from '../shared/toast.jsx';
import { Photo } from '../shared/Photo.jsx';
import { Gallery } from './Gallery.jsx';
import { FindUs } from './FindUs.jsx';
import { Icon } from '../shared/Icon.jsx';
import { fmt12 } from '../shared/format.js';
import { categoryPath, deliveryRange, faqs, meals, serviceArea, servicesText, hoursText } from '../shared/seo.js';
import { track } from '../shared/track.js';
import { outletList } from '../shared/outlets.js';

/* ---------- Hero ---------- */
function Hero() {
  const { settings } = useSite();
  const outlets = outletList(settings).length;
  const heroPizza = useMemo(() => pizza({ seed: 22, id: 'hero' }), []);

  return (
    <div className="hero" id="hero">
      <div className="hero-dots" aria-hidden="true" />

      <div className="wrap hero-grid">
        <div className="hero-copy">
          <p className="eyebrow hero-h1"><Icon name="flame" /> Pizza restaurant in {serviceArea(settings)} · Home of the GIANT 22" pizza</p>

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
            {outlets > 1
              ? <li><b>{outlets}</b><span>outlets</span></li>
              : <li><b>{fmt12(settings.hoursClose).replace(':00', '')}</b><span>open daily till</span></li>}
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

// From the menu: each size's lowest pizza price, its price per square inch, and which size
// is really the best value (so the badge can't claim something the prices don't back up).
function sizePrices(site) {
  const pizzas = site.menu.filter((m) => m.isPizza && m.available);
  const rows = SIZES.map((s) => {
    const def = site.defaults.SIZES.find((x) => x.key === s.key);
    const prices = pizzas.flatMap((p) => p.prices.filter((x) => x.label === (def && def.label)).map((x) => x.price));
    const from = prices.length ? Math.min(...prices) : 0;
    return { from, perSq: from / (Math.PI * (s.inch / 2) ** 2) };
  });
  const priced = rows.filter((r) => r.from);
  const best = priced.length ? rows.indexOf(priced.reduce((a, b) => (b.perSq < a.perSq ? b : a))) : -1;
  return { rows, best };
}

function SizeGuide() {
  const site = useSite();
  const { rows, best } = useMemo(() => sizePrices(site), [site.menu, site.defaults]); // eslint-disable-line react-hooks/exhaustive-deps
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
                data-badge={i === best ? 'BEST VALUE' : s.key === 'XL' ? 'BIGGEST' : undefined}
                role="radio" aria-checked={i === sel} onClick={() => { setSel(i); track('size_select', { value: s.key }); }} onKeyDown={(e) => onKey(e, i)}>
                <b>{s.inch}"</b><span>{s.name}</span><em>{s.who}</em>
                {rows[i].from > 0 && <>
                  <strong className="size-from">from {site.money(rows[i].from)}</strong>
                  <small className="size-sq">{site.settings.currency} {rows[i].perSq.toFixed(2)} per sq in</small>
                </>}
              </button>
            ))}
          </div>
        </div>
        <p className="size-note">A {info.inch}" pizza = <b>{ratio.toFixed(1)}×</b> a 12". {info.note}</p>
        <div className="center mt"><Link to={'/menu?size=' + info.key} className="btn btn-red">See {info.inch}" pizzas</Link></div>
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
          <h2 className="section-title" id="mealsTitle">Pizza restaurant in {serviceArea(s)}</h2>
          <p className="meals-lead">
            {s.name} is a pizza and fried chicken restaurant in {serviceArea(s)}. {services.charAt(0).toUpperCase() + services.slice(1)}
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
            <p>Pizza delivery across {serviceArea(s)}, hot from the oven. Delivery fee {deliveryRange(s)}.</p></li>
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
          <h2 className="section-title center" id="faqTitle">Questions? Answers.</h2>
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

/* ---------- A crowd favourite: its picture and name open its menu section; Add takes its first size ---------- */
function Pick({ item }) {
  const site = useSite(), toast = useToast();
  const art = useMemo(() => (item.image ? '' : iconFor(item)), [item]);
  const cat = site.categories.find((c) => c.id === item.category);
  const first = item.prices[0], n = site.cartQty(item.id, first.label);
  const add = () => {
    if (!site.addToCart(item.id, first.label, 1)) return;
    track('add_to_cart', { item_id: item.id, value: first.label, num: 1 });
    toast('Added ' + item.name + ' (' + first.label + ')');
  };
  return (
    <>
      <Link to={cat ? categoryPath(cat) : '/menu'} className="pick">
        {item.image
          ? <span className="pick-art"><Photo media={item.image} alt={item.image.alt || item.name} sizes="220px" /></span>
          : <Art as="span" className="pick-art" html={art} />}
        <span className="pick-name">{item.name}</span>
        <span className="pick-price">{first.label} · {site.money(first.price)}</span>
      </Link>
      {n
        ? (
          <div className="stepper pick-action" role="group" aria-label={'Quantity of ' + item.name}>
            <button type="button" aria-label="Remove one" onClick={() => site.setQty(item.id, first.label, n - 1)}><Icon name={n === 1 ? 'trash' : 'minus'} /></button>
            <output>{n}</output>
            <button type="button" aria-label="Add one more" onClick={() => site.setQty(item.id, first.label, n + 1)}><Icon name="plus" /></button>
          </div>
        )
        : <button type="button" className="btn btn-yellow btn-sm pick-action" aria-label={'Add ' + item.name + ' (' + first.label + ') to your order'} onClick={add}><Icon name="plus" /> Add</button>}
    </>
  );
}

// Four favourites that look different from each other, always including fried chicken.
function choosePicks(menu) {
  const seen = new Set();
  const varied = menu.filter((m) => m.popular && m.available).filter((m) => {
    const look = artKey(m);
    if (seen.has(look)) return false;
    seen.add(look);
    return true;
  });
  const chicken = varied.filter((m) => m.category === 'special').slice(0, 1);
  return chicken.concat(varied.filter((m) => m.category !== 'special')).slice(0, 4);
}

/* ---------- Home view ---------- */
export function HomeView() {
  const site = useSite(), s = site.settings;
  const picks = choosePicks(site.menu);

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
            <h2 className="section-title" id="specialsTitle">OHH!!! My Picks</h2>
          </div>
          <ul className="picks">{picks.map((i) => <li key={i.id}><Pick item={i} /></li>)}</ul>
          <div className="center mt"><Link to="/menu" className="btn btn-red">See the full menu</Link></div>
        </div>
      </section>

      <Gallery />

      <section className="section section-yellow" aria-labelledby="howTitle">
        <div className="wrap">
          <h2 className="section-title" id="howTitle">Hot to your door in 3 steps</h2>
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
