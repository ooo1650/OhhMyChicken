/* ==========================================================================
   App — routes, page <head>, header/nav, offer pop-up and footer.
   ========================================================================== */
import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { useSite, promoSeen, markPromoSeen } from './store.jsx';
import { useRoute, Link } from './router.jsx';
import { HomeView } from './Home.jsx';
import { MenuView } from './Menu.jsx';
import { CartBar, CartDrawer } from './Cart.jsx';
import { Chat } from './Chat.jsx';
import { Icon } from '../shared/Icon.jsx';
import { useToast } from '../shared/toast.jsx';
import { useLayer } from '../shared/layer.js';
import { reducedMotion } from '../shared/format.js';
import { resolveRoute, applyHead, categoryPath, hoursText } from '../shared/seo.js';

function Brand({ className }) {
  return (
    <Link to="/" className={'brand' + (className ? ' ' + className : '')} aria-label="Ohh My Chicken! home">
      <span className="brand-block brand-ohh">OHH</span>
      <span className="brand-block brand-my">MY</span>
      <span className="brand-block brand-chicken">CHICKEN!</span>
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

  useEffect(() => {
    if (!site.promoOpen || reducedMotion) return;
    gsap.fromTo(ref.current.querySelector('.promo-card'), { scale: 0.6, rotation: -6, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: 0.6, ease: 'back.out(2)' });
    gsap.fromTo(ref.current.querySelector('.promo-burst'), { rotation: -180, scale: 0 }, { rotation: -12, scale: 1, duration: 0.8, delay: 0.15, ease: 'back.out(2.5)' });
  }, [site.promoOpen]);

  const copy = () => {
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
          <Brand className="brand-footer" />
          <p className="muted">Pizza restaurant in {s.city}: giant pizzas, crispy chicken &amp; MoMo for lunch, dinner and delivery.</p>
          {/* Name, address, phone: the same as in the structured data, for local search. */}
          <address className="footer-nap">
            <span>{[s.street, s.address].filter(Boolean).join(', ')}</span>
            {s.phone && <a href={'tel:' + s.phone.replace(/\s/g, '')}>{s.phone}</a>}
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
      <p className="wrap copyright">© {new Date().getFullYear()} {s.name} All rights reserved.</p>
    </footer>
  );
}

export function App() {
  const site = useSite();
  const route = useRoute();
  const boot = useMemo(() => ({ defaults: site.defaults, menu: site.menu, settings: site.settings }), [site.defaults, site.menu, site.settings]);
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
    const changed = prevView.current !== page.view;
    prevView.current = page.view;
    setView(page.view);

    if (page.view === 'menu') {
      const t = String(route.params.table || '').replace(/[^\w-]/g, '').slice(0, 6);
      if (t) {
        setTable(t);
        site.setCheckout((c) => (c.address ? c : { ...c, address: 'Table ' + t }));
      }
      if (page.cat) site.jumpToCategory(page.cat.id);
      else if (changed) window.scrollTo(0, 0);
      return undefined;
    }
    if (page.section) {
      const timer = setTimeout(() => {
        const target = document.getElementById(page.section), header = document.getElementById('siteHeader');
        const y = target.getBoundingClientRect().top + window.scrollY - header.offsetHeight + 1;
        window.scrollTo({ top: y, behavior: reducedMotion || changed ? 'auto' : 'smooth' });
      }, changed ? 60 : 0);
      return () => clearTimeout(timer);
    }
    if (changed) window.scrollTo(0, 0);
    else window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
    return undefined;
  }, [route.n]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fade the newly shown view in.
  useEffect(() => {
    if (reducedMotion) return;
    gsap.fromTo('#view-' + view, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out', clearProps: 'transform' });
  }, [view]);

  // Offer pop-up once per session, after the configured delay (not on error pages).
  useEffect(() => {
    if (page.view === 'notfound') return undefined;
    const t = setTimeout(() => {
      if (!site.settings.promo.enabled || promoSeen() || document.documentElement.classList.contains('no-scroll')) return;
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
