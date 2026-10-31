/* ==========================================================================
   Menu — customer menu with instant search, a scroll-spy category bar,
   diet filters, variant pickers and add-to-cart steppers. DishCard is also
   used by the home "popular" row.
   ========================================================================== */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSite } from './store.jsx';
import { Art, iconFor } from './art.jsx';
import { Icon, DietMark } from '../shared/Icon.jsx';
import { Photo } from '../shared/Photo.jsx';
import { useToast } from '../shared/toast.jsx';
import { dietLabel, fmt12, PIZZA_CATEGORIES } from '../shared/format.js';
import { categoryPath, deliveryRange, pageMeta, serviceArea } from '../shared/seo.js';
import { navigate } from './router.jsx';
import { track } from '../shared/track.js';

const DIETS = ['all', 'veg', 'chicken', 'buff', 'pork'];

function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

// "Strong" text: what a dish IS (name, description, diet, pizza/size words).
function strongText(item) {
  return norm([item.name, item.desc, dietLabel(item.diet), item.isPizza ? 'pizza' : '',
    item.prices.map((p) => p.label).join(' ')].join(' '));
}

// Every query word must match. A word is matched against the category name only
// when no dish matches it directly — so "buff" finds buff dishes, while
// "specials" or "extras" still filter by category.
function makeMatcher(q, menu, categoryName) {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return () => true;
  const strong = {};
  menu.forEach((m) => { strong[m.id] = strongText(m); });
  const useCat = words.map((w) => !menu.some((m) => strong[m.id].includes(w)));
  return (item) => words.every((w, i) => strong[item.id].includes(w) || (useCat[i] && norm(categoryName(item.category)).includes(w)));
}

function Highlight({ text, q }) {
  const words = (q || '').trim().split(/\s+/).filter((w) => w.length > 1).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!words.length) return text;
  const parts = String(text).split(new RegExp('(' + words.join('|') + ')', 'gi'));
  return parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p));
}

function dietMatch(item, diet) {
  if (diet === 'all' || item.diet === diet) return true;
  return item.diet === 'mix' && diet !== 'veg'; // mixed meat counts for every meat filter
}

/* ---------- Card ---------- */
export function DishCard({ item, q }) {
  const site = useSite(), toast = useToast();
  const [label, setLabel] = useState(item.prices[0].label);
  // Arriving from a size card on the home page: that size is already chosen.
  useEffect(() => {
    if (site.menuSize && item.prices.some((p) => p.label === site.menuSize)) setLabel(site.menuSize);
  }, [site.menuSize, item]);
  const actionRef = useRef(null), focusStep = useRef(false);
  const [broken, setBroken] = useState(false);
  const photo = broken ? null : item.image; // a library photo when the dish has one, otherwise its drawing
  const art = useMemo(() => (photo ? '' : iconFor(item)), [item, photo]);
  const price = (item.prices.find((p) => p.label === label) || item.prices[0]).price;
  const n = site.cartQty(item.id, label), what = item.name + ' (' + label + ')';

  // After "Add", move focus to the + button that replaced it.
  useEffect(() => {
    if (focusStep.current && n) {
      focusStep.current = false;
      const step = actionRef.current && actionRef.current.querySelector('[data-step="1"]');
      if (step) step.focus({ preventScroll: true });
    }
  }, [n]);

  function add() {
    focusStep.current = true;
    site.addToCart(item.id, label, 1);
    track('add_to_cart', { item_id: item.id, value: label, num: 1 });
    toast('Added ' + item.name + ' (' + label + ')');
  }

  let action;
  const s = site.settings;
  if (!item.available) action = <span className="sold-tag">Sold out</span>;
  // Counter-made drinks stay on the menu, but only a table or pickup order can include them.
  else if (item.noDelivery && (site.checkout.mode || 'delivery') === 'delivery') action = <span className="sold-tag">{s.dineIn && !s.takeaway ? 'Dine-in only' : 'Not for delivery'}</span>;
  else if (!n) action = <button type="button" className="btn btn-red btn-sm add-btn" aria-label={'Add ' + what + ' to your order'} onClick={add}><Icon name="plus" /> Add</button>;
  else action = (
    <div className="stepper" role="group" aria-label={'Quantity of ' + what}>
      <button type="button" data-step="-1" aria-label="Remove one" onClick={() => site.setQty(item.id, label, n - 1)}><Icon name={n === 1 ? 'trash' : 'minus'} /></button>
      <output>{n}</output>
      <button type="button" data-step="1" aria-label="Add one more" onClick={() => site.setQty(item.id, label, n + 1)}><Icon name="plus" /></button>
    </div>
  );

  return (
    <article className={'dish' + (item.available ? '' : ' is-sold')}>
      {photo
        ? <div className="dish-art has-photo"><Photo media={photo} alt={photo.alt || item.name} sizes="(max-width: 600px) 90px, 120px" onFail={() => setBroken(true)} /></div>
        : <Art className="dish-art" html={art} />}
      <div className="dish-body">
        <div className="dish-meta">
          <DietMark diet={item.diet} /><span>{dietLabel(item.diet)}</span>
          {item.popular && <span className="tag-pop"><Icon name="flame" />Popular</span>}
        </div>
        <h3 className="dish-name"><Highlight text={item.name} q={q} /></h3>
        {item.desc && <p className="dish-desc"><Highlight text={item.desc} q={q} /></p>}
      </div>
      <div className="dish-opts">
        {item.prices.length > 1
          ? <div className="seg" role="radiogroup" aria-label={'Choose an option for ' + item.name}>
              {item.prices.map((p) => (
                <button key={p.label} type="button" role="radio" aria-checked={p.label === label}
                  className={/22/.test(p.label) && item.isPizza ? 'is-xl' : undefined} onClick={() => setLabel(p.label)}>{p.label}</button>
              ))}
            </div>
          : <p className="dish-variant">{item.prices[0].label}</p>}
      </div>
      <div className="dish-foot">
        <span className="dish-price">{site.money(price)}</span>
        <div className="dish-action" ref={actionRef}>{action}</div>
      </div>
    </article>
  );
}

/* ---------- Menu view ---------- */
export function MenuView({ active, table, cat }) {
  const site = useSite();
  const { menu, categories, menuQuery: query, menuDiet: diet, menuJump } = site;
  const searchRef = useRef(null), navRef = useRef(null), listRef = useRef(null), toolbarRef = useRef(null);
  const [activeCat, setActiveCat] = useState(null);
  const q = query.trim();

  const { sections, counts, total } = useMemo(() => {
    const matches = makeMatcher(q, menu, site.categoryName);
    const counts = {};
    let total = 0;
    const sections = categories.map((c) => {
      const items = menu.filter((m) => m.category === c.id && dietMatch(m, diet) && matches(m));
      counts[c.id] = items.length;
      total += items.length;
      return { c, items };
    }).filter((s) => s.items.length);
    return { sections, counts, total };
  }, [q, diet, menu, categories, site.categoryName]);

  // What people search for, and whether it found anything (sent once they stop typing).
  useEffect(() => {
    if (q.length < 2) return undefined;
    const t = setTimeout(() => track('search', { value: q, num: total }), 1200);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- Scroll spy ---------- */
  const stickyOffset = useCallback(() => {
    const header = document.getElementById('siteHeader');
    return (header ? header.offsetHeight : 0) + (toolbarRef.current ? toolbarRef.current.offsetHeight : 0);
  }, []);

  const activeRef = useRef(null);
  const setActive = useCallback((id) => {
    if (activeRef.current === id) return;
    activeRef.current = id;
    setActiveCat(id);
    // Keep the active link visible in the horizontally scrolling bar.
    const nav = navRef.current, current = nav && nav.querySelector('[data-cat="' + id + '"]');
    if (current && nav.scrollWidth > nav.clientWidth) {
      nav.scrollTo({ left: current.offsetLeft - nav.clientWidth / 2 + current.offsetWidth / 2, behavior: 'auto' });
    }
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    let queued = false;
    const spy = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        if (!listRef.current) return;
        const line = stickyOffset() + 24, secs = listRef.current.querySelectorAll('.menu-cat');
        let id = null;
        secs.forEach((sec) => { if (sec.getBoundingClientRect().top <= line) id = sec.dataset.cat; });
        setActive(id || (secs[0] && secs[0].dataset.cat));
      });
    };
    spy();
    window.addEventListener('scroll', spy, { passive: true });
    window.addEventListener('resize', spy, { passive: true });
    return () => { window.removeEventListener('scroll', spy); window.removeEventListener('resize', spy); };
  }, [active, sections, stickyOffset, setActive]);

  const scrollToCat = useCallback((id) => {
    const sec = document.getElementById('cat-' + id);
    if (!sec) return;
    const y = sec.getBoundingClientRect().top + window.scrollY - stickyOffset() - 8;
    window.scrollTo({ top: y, behavior: 'auto' });
    setActive(id);
  }, [stickyOffset, setActive]);

  // The chatbot asks to jump to a category.
  useEffect(() => {
    if (!menuJump) return undefined;
    const t = setTimeout(() => scrollToCat(menuJump.cat), 80);
    return () => clearTimeout(t);
  }, [menuJump, scrollToCat]);

  // "/" focuses search on the menu view
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => {
      if (e.key !== '/' || /input|textarea|select/i.test(document.activeElement.tagName)) return;
      e.preventDefault(); searchRef.current.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active]);

  const s = site.settings;
  const boot = { defaults: site.defaults, menu, settings: s };

  return (
    <section className="view" id="view-menu" hidden={!active}>
      <div className="menu-hero">
        <div className="wrap menu-hero-inner">
          <div>
            {cat
              ? <>
                  <h1 className="section-title light">{pageMeta({ view: 'menu', cat }, boot).heading}</h1>
                  <p className="menu-sub menu-blurb">{cat.blurb}</p>
                </>
              : <>
                  <h1 className="section-title light">The Menu</h1>
                  <p className="menu-sub">Pizza, fried chicken &amp; MoMo in {serviceArea(s)}: giant pizzas in 12" · 15" · 18" · <b>22" XL</b>, with prices.</p>
                </>}
          </div>
          <ul className="menu-facts" aria-label="Ordering info">
            <li className={site.isOpen ? undefined : 'is-closed'}><Icon name="clock" /><span>{site.isOpen ? 'Open now · until ' + fmt12(s.hoursClose) : 'Closed · opens ' + fmt12(s.hoursOpen)}</span></li>
            <li><Icon name="bike" /><span>Delivery <b>{deliveryRange(s)}</b></span></li>
          </ul>
        </div>
      </div>
      <p className="table-banner" hidden={!table}>
        <Icon name="utensils" /><span>Ordering for <b>Table {table}</b>. We'll bring it to your table.</span>
      </p>

      <div className="menu-toolbar" ref={toolbarRef}>
        <div className="wrap">
          <div className="search-wrap">
            <Icon name="search" />
            <input type="search" ref={searchRef} value={query} onChange={(e) => site.setMenuQuery(e.target.value)}
              placeholder="Search pizzas, momo, wings…" aria-label="Search menu" autoComplete="off"  maxLength="60" />
            <kbd className="hide-sm">/</kbd>
          </div>
          <nav className="cat-nav" ref={navRef} aria-label="Menu sections">
            {categories.map((c) => (
              // Real links to each category page (crawlable); a click scrolls in place.
              <a key={c.id} href={categoryPath(c)} className="cat-link" data-cat={c.id} aria-disabled={!counts[c.id] || undefined}
                aria-current={activeCat === c.id ? 'true' : undefined}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                  e.preventDefault();
                  if (!counts[c.id]) return;
                  track('cat_click', { category: c.slug });
                  if (location.pathname === categoryPath(c)) scrollToCat(c.id); else navigate(categoryPath(c), { replace: true });
                }}>
                <Icon name={c.icon} /><span>{c.short}</span><small>{counts[c.id] || 0}</small>
              </a>
            ))}
          </nav>
        </div>
      </div>

      <div className="wrap menu-body">
        <div className="menu-filter-row">
          <div className="diet-chips" role="group" aria-label="Dietary filter">
            {DIETS.map((d) => (
              <button key={d} type="button" className="chip chip-sm" aria-pressed={diet === d} onClick={() => { site.setMenuDiet(d); track('diet_filter', { value: d }); }}>
                {d === 'all' ? 'All' : <><DietMark diet={d} />{dietLabel(d)}</>}
              </button>
            ))}
          </div>
          <p className="result-count" aria-live="polite">
            {q || diet !== 'all' ? total + ' dish' + (total === 1 ? '' : 'es') + ' found' : total + ' dishes'}
          </p>
        </div>
        <div ref={listRef}>
          {sections.map(({ c, items }) => (
            <section key={c.id} className="menu-cat" id={'cat-' + c.id} data-cat={c.id} aria-labelledby={'cat-title-' + c.id}>
              <header className="cat-head">
                <span className="cat-ico"><Icon name={c.icon} /></span>
                <div>
                  <h2 className="cat-title" id={'cat-title-' + c.id}>{c.name}</h2>
                  <p className="cat-sub">{items.length} item{items.length === 1 ? '' : 's'}
                    {PIZZA_CATEGORIES.includes(c.id) && <> · 12" S · 15" M · 18" L · <b>22" XL</b></>}</p>
                </div>
              </header>
              <div className="card-grid">{items.map((i) => <DishCard key={i.id} item={i} q={q} />)}</div>
            </section>
          ))}
          {!sections.length && (
            <div className="empty">
              <span className="empty-ico"><Icon name="search" /></span>
              <p>No dishes match “{q}”{diet !== 'all' ? ' in ' + dietLabel(diet) : ''}.</p>
              <button className="btn btn-outline btn-sm" onClick={() => { site.clearMenuFilters(); searchRef.current.focus(); }}>Clear filters</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
