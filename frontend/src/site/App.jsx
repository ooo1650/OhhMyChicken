/* ==========================================================================
   App — routes, page <head>, header/nav, offer pop-up and footer.
   ========================================================================== */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSite, promoSeen, markPromoSeen } from './store.jsx';
import { useRoute, Link } from './router.jsx';
import { HomeView } from './Home.jsx';
import { MenuView } from './Menu.jsx';
import { CartBar, CartDrawer } from './Cart.jsx';
import { Chat } from './Chat.jsx';
import { Icon } from '../shared/Icon.jsx';
import { useToast } from '../shared/toast.jsx';
import { useLayer } from '../shared/layer.js';
import { resolveRoute, applyHead, categoryPath, hoursText } from '../shared/seo.js';
import { track } from '../shared/track.js';
import { outletList, outletTitle, telHref } from '../shared/outlets.js';
import logo192 from '../assets/logo-192.webp';
import logo240 from '../assets/logo-240.webp';

// The restaurant's logo. Imported so Vite gives it a content-hashed URL that browsers cache for a year;
// the small one is also preloaded from index.html.
function Brand({ footer }) {
  const site = useSite();
  return (
    <Link to="/" className={'brand' + (footer ? ' brand-footer' : '')} aria-label={site.settings.name + ' home'}>
      {footer
        ? <img className="brand-logo" src={logo240} width="260" height="240" alt={site.settings.name} loading="lazy" decoding="async" />
        : <img className="brand-logo" src={logo192} width="208" height="192" alt={site.settings.name} fetchPriority="high" />}
    </Link>
  );
}

function Header({ navKey, n }) {
  const site = useSite(), count = site.cartCount;
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => setOpen(false), [n]);

  const item = (key, to, label) => (
    <Link to={to} className={navKey === key ? 'active' : undefined} aria-current={navKey === key ? 'page' : undefined}>{label}</Link>
  );
  return (
    <header className={'site-header' + (scrolled ? ' scrolled' : '')} id="siteHeader">
      <div className="wrap header-inner">
        <Brand />
        <nav className={'main-nav' + (open ? ' open' : '')} id="mainNav" aria-label="Main">
          {item('home', '/', 'Home')}
          {item('menu', '/menu', 'Menu')}
          {item('sizes', '/sizes', 'Sizes')}
          {item('find', '/find', 'Find Us')}
        </nav>
        <div className="header-actions">
          <span className={'open-pill ' + (site.isOpen ? 'is-open' : 'is-closed')} aria-live="polite">{site.isOpen ? 'Open now' : 'Closed'}</span>
          <button className="icon-btn cart-btn" id="cartBtn" aria-label={'Open cart, ' + count + ' item' + (count === 1 ? '' : 's')} onClick={() => site.setCartOpen(true)}>
            <Icon name="bag" />
            <span className="badge" hidden={!count}>{count}</span>
          </button>
          <Link to="/menu" className="btn btn-yellow btn-sm hide-sm">Order Online</Link>
          <button className="icon-btn nav-toggle" aria-label="Toggle navigation" aria-expanded={open} aria-controls="mainNav" onClick={() => setOpen(!open)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
          </button>
        </div>
      </div>
    </header>
  );
}

function PromoModal() {
  const site = useSite(), toast = useToast(), p = site.settings.promo;
  const ref = useRef(null);
  const close = () => site.setPromoOpen(false);
  const { hidden, isOpen } = useLayer(site.promoOpen, ref, { onClose: close, focus: '.code-pill' });

  useEffect(() => { if (site.promoOpen) track('promo_shown'); }, [site.promoOpen]);

  const copy = () => {
    track('promo_copied');
    const done = () => toast('Code ' + p.code + ' copied and added to your order');
    site.applyCode(p.code);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(p.code).then(done, done); else done();
  };

  return (
    <div className={'modal' + (isOpen ? ' is-open' : '')} ref={ref} role="dialog" aria-modal="true" aria-labelledby="promoTitle" hidden={hidden}>
      <div className="modal-backdrop" onClick={close} />
      <div className="modal-card promo-card">
        <button className="icon-btn close-btn" onClick={close} aria-label="Close offer"><Icon name="x" /></button>
        <div className="promo-burst" aria-hidden="true"><span>{p.percent}%</span><small>OFF</small></div>
        <h2 id="promoTitle">{p.headline}</h2>
        <p>Use this code at checkout:</p>
        <button className="code-pill" title="Copy code" onClick={copy}><span>{p.code}</span> <small>tap to copy</small></button>
        <div className="hero-ctas center">
          <Link to="/menu" className="btn btn-red" onClick={close}>Grab a 22" now</Link>
          <button className="btn btn-link" onClick={close}>No thanks</button>
        </div>
      </div>
    </div>
  );
}

function NotFoundView({ active }) {
  return (
    <section className="view section section-light not-found" id="view-notfound" hidden={!active}>
      <div className="wrap center">
        <p className="eyebrow eyebrow-red">Error 404</p>
        <h1 className="tilt-title"><span>Ohh no!</span> <span className="hl">Page not found</span></h1>
        <p className="nf-text">This page went out for delivery and never came back. Try the menu instead.</p>
        <div className="hero-ctas center">
          <Link to="/menu" className="btn btn-red">See the menu</Link>
          <Link to="/" className="btn btn-outline">Home</Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const site = useSite(), s = site.settings;
  const cats = site.categories.filter((c) => site.menu.some((m) => m.category === c.id));
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div className="footer-about">
          <Brand footer />
          <p className="muted">Pizza restaurant in {s.city}: giant pizzas, crispy chicken &amp; MoMo for lunch, dinner and delivery.</p>
          {/* Name, address, phone: the same as in the structured data, for local search. */}
          <address className="footer-nap">
            {outletList(s).map((o) => (
              <span key={o.id || 'main'} className="footer-outlet">
                <b>{o.single ? [s.street, s.address].filter(Boolean).join(', ') : outletTitle(o)}</b>
                {o.phones[0] && <a href={telHref(o.phones[0])}>{o.phones[0]}</a>}
              </span>
            ))}
            <span>Open daily {hoursText(s)}</span>
          </address>
        </div>
        <nav className="footer-links" aria-label="Menu categories">
          <b>Menu</b>
          {cats.map((c) => <Link key={c.id} to={categoryPath(c)}>{c.short}</Link>)}
        </nav>
        <nav className="footer-links" aria-label="Footer">
          <b>Visit</b>
          <Link to="/menu">Full menu &amp; prices</Link>
          <Link to="/sizes">Pizza sizes</Link>
          <Link to="/find">Find us</Link>
          {s.mapsUrl && <a href={s.mapsUrl} target="_blank" rel="noopener">Directions</a>}
          <button type="button" onClick={() => site.setChatOpen(true)}>Chat</button>
        </nav>
      </div>
      <p className="wrap copyright">© {new Date().getFullYear()} {s.name} All rights reserved.
        {' '}We count visits anonymously to improve the menu: no cookies, no ads, no tracking across sites, and your browser's "Do Not Track" is respected.</p>
      {/* Agency credit: who builds and runs the site, and how to reach them for one of your own. */}
      <div className="wrap made-by">
        <p>Designed, built &amp; looked after by <b>PaperKite</b>, from hosting to security and monitoring.</p>
        <a href="mailto:paperkite.contact@gmail.com?subject=A%20website%20like%20Ohh%20My%20Chicken" className="made-by-cta">
          Want a site like this? <span>paperkite.contact@gmail.com</span>
        </a>
      </div>
    </footer>
  );
}

export function App() {
  const site = useSite();
  const route = useRoute();
  const boot = useMemo(() => ({ defaults: site.defaults, menu: site.menu, settings: site.settings, gallery: site.gallery }), [site.defaults, site.menu, site.settings, site.gallery]);
  const page = resolveRoute(route.pathname, site.categories);
  const [view, setView] = useState(page.view);
  const [table, setTable] = useState('');
  const prevView = useRef(null);
  const navKey = page.view === 'menu' ? 'menu' : page.section || (page.view === 'home' ? 'home' : '');

  // Route changes: view, scroll, <head>, table orders, offer preview.
  useEffect(() => {
    // The dashboard's "Preview pop-up" link opens the site at /?offer=1.
    if (route.params.offer) {
      history.replaceState(null, '', location.pathname);
      setTimeout(() => { markPromoSeen(); site.setPromoOpen(true); }, 400);
    }
    applyHead(page, boot);
    // Anonymous page view. The referring site's name is sent only on the first one.
    let referrer = null;
    if (!route.n && document.referrer) { try { const h = new URL(document.referrer).host; if (h !== location.host) referrer = h; } catch (e) { /* ignore */ } }
    track('page_view', { path: location.pathname, referrer, table_no: route.params.table || null });
    const changed = prevView.current !== page.view;
    prevView.current = page.view;
    setView(page.view);

    if (page.view === 'menu') {
      const t = String(route.params.table || '').replace(/[^\w-]/g, '').slice(0, 6);
      const o = String(route.params.outlet || '').replace(/[^a-z0-9-]/g, '').slice(0, 40);
      if (o && (site.settings.outlets || []).some((x) => x.id === o && x.active !== false)) site.setTableOutlet(o);
      if (t) {
        setTable(t);
        if (site.settings.dineIn) site.setCheckout((c) => ({ ...c, mode: 'table', table: t }));
      }
      if (page.cat) site.jumpToCategory(page.cat.id);
      else if (changed) window.scrollTo(0, 0);
      return undefined;
    }
    if (page.section) {
      const timer = setTimeout(() => {
        const target = document.getElementById(page.section), header = document.getElementById('siteHeader');
        const y = target.getBoundingClientRect().top + window.scrollY - header.offsetHeight + 1;
        window.scrollTo({ top: y, behavior: 'auto' });
      }, changed ? 60 : 0);
      return () => clearTimeout(timer);
    }
    if (changed) window.scrollTo(0, 0);
    else window.scrollTo({ top: 0, behavior: 'auto' });
    return undefined;
  }, [route.n]); // eslint-disable-line react-hooks/exhaustive-deps

  // Offer pop-up once per session, after the configured delay (not on error pages).
  useEffect(() => {
    if (page.view === 'notfound') return undefined;
    const t = setTimeout(() => {
      if (!site.settings.promo.enabled || !site.settings.promo.popup || promoSeen() || document.documentElement.classList.contains('no-scroll')) return;
      markPromoSeen();
      site.setPromoOpen(true);
    }, Math.max(0, +site.settings.promo.delaySec || 0) * 1000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main').focus(); }}>Skip to content</a>
      <Header navKey={navKey} n={route.n} />
      <main id="main" tabIndex={-1}>
        <HomeView active={view === 'home'} />
        <MenuView active={view === 'menu'} table={table} cat={view === 'menu' ? page.cat : null} />
        <NotFoundView active={view === 'notfound'} />
      </main>
      <CartBar />
      <Footer />
      <CartDrawer />
      <PromoModal />
      <Chat />
    </>
  );
}
