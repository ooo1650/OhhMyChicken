/* ==========================================================================
   Site store — menu & settings come from the API (GET /api/bootstrap);
   the cart and promo flags stay in localStorage. Also holds the bits of UI
   state several parts share (cart drawer, chat, menu filters, checkout).
   ========================================================================== */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../shared/api.js';
import { isOpenNow, money } from '../shared/format.js';

const KEYS = { cart: 'omc.cart.v1', promoSeen: 'omc.promoSeen.v1', promoUsed: 'omc.promoUsed.v1', outlet: 'omc.outlet.v1' };

function read(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; }
}
function write(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* storage blocked: keep in memory */ }
}

export const promoSeen = () => { try { return sessionStorage.getItem(KEYS.promoSeen) === '1'; } catch (e) { return false; } };
export const markPromoSeen = () => { try { sessionStorage.setItem(KEYS.promoSeen, '1'); } catch (e) { /* ignore */ } };
const promoUsed = () => read(KEYS.promoUsed, false);

const SiteCtx = createContext(null);
export const useSite = () => useContext(SiteCtx);

export function SiteProvider({ boot, children }) {
  const { defaults } = boot;
  const [menu] = useState(boot.menu);
  const [settings] = useState(boot.settings);
  const [gallery] = useState(boot.gallery || []);
  // A saved cart can name dishes or sizes that have since left the menu: drop those lines.
  const [cart, setCartState] = useState(() => {
    const saved = read(KEYS.cart, []);
    const ok = Array.isArray(saved) ? saved.filter((c) => boot.menu.some((m) => m.id === c.id && m.prices.some((p) => p.label === c.label))) : [];
    if (!Array.isArray(saved) || ok.length !== saved.length) write(KEYS.cart, ok);
    return ok;
  });
  const [now, setNow] = useState(() => new Date());
  // The outlet the customer last ordered from (pre-selected next time), and one fixed by a table QR code.
  const [outletId, setOutletIdState] = useState(() => read(KEYS.outlet, ''));
  const [tableOutlet, setTableOutlet] = useState('');

  // Shared UI state
  const [cartOpen, setCartOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [checkout, setCheckout] = useState({ mode: 'delivery', table: '', name: '', phone: '', address: '', saveDetails: false });
  const [menuQuery, setMenuQuery] = useState('');
  const [menuDiet, setMenuDiet] = useState('all');
  const [menuJump, setMenuJump] = useState(null); // { cat, n } — scroll to a category

  // Keep the open/closed pill honest.
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);

  const setCart = useCallback((c) => { write(KEYS.cart, c); setCartState(c); }, []);
  const setOutletId = useCallback((id) => { write(KEYS.outlet, id); setOutletIdState(id); }, []);
  const getItem = useCallback((id) => menu.find((m) => m.id === id), [menu]);

  const value = useMemo(() => {
    const cartQty = (id, label) => { const l = cart.find((c) => c.id === id && c.label === label); return l ? l.qty : 0; };
    const cartLines = cart.map((c) => {
      const item = getItem(c.id);
      if (!item) return null;
      const p = item.prices.find((x) => x.label === c.label);
      if (!p) return null;
      return { id: c.id, label: c.label, qty: c.qty, name: item.name, unit: +p.price, total: +p.price * c.qty, item };
    }).filter(Boolean);

    /* Totals. The promo applies to ONE 22" XL pizza (the priciest one in the cart). */
    // Same maths as the server. The delivery fee is a range the outlet confirms, so it isn't in the total.
    function totals(code) {
      const s = settings;
      const subtotal = cartLines.reduce((n, l) => n + l.total, 0);
      let discount = 0, promoMsg = '';
      if (code) {
        const promoOk = s.promo.enabled && code.trim().toUpperCase() === String(s.promo.code).toUpperCase();
        if (!promoOk) promoMsg = 'That code is not valid.';
        else if (promoUsed()) promoMsg = 'Promo already used on this device.';
        else {
          const xl = cartLines.filter((l) => l.item.isPizza && /22/.test(l.label)).sort((a, b) => b.unit - a.unit)[0];
          if (!xl) promoMsg = 'Add a 22" XL pizza to use this code.';
          else { discount = Math.round(xl.unit * s.promo.percent / 100); promoMsg = s.promo.percent + '% off your 22" ' + xl.name + '!'; }
        }
      }
      return { subtotal, discount, total: subtotal - discount, promoMsg };
    }

    function addToCart(id, label, qty) {
      const item = getItem(id);
      if (!item) return;
      const price = item.prices.find((p) => p.label === label) || item.prices[0];
      const next = cart.map((c) => ({ ...c }));
      const line = next.find((c) => c.id === id && c.label === price.label);
      if (line) line.qty += qty || 1;
      else next.push({ id, label: price.label, qty: qty || 1 });
      setCart(next);
    }
    function setQty(id, label, qty) {
      setCart(cart.map((c) => (c.id === id && c.label === label ? { id, label, qty } : c)).filter((c) => c.qty > 0));
    }

    return {
      defaults, menu, settings, gallery, cart, now,
      categories: defaults.CATEGORIES,
      categoryName: (id) => { const c = defaults.CATEGORIES.find((x) => x.id === id); return c ? c.name : id; },
      getItem, cartQty, cartLines, totals, addToCart, setQty,
      clearCart: () => setCart([]),
      cartCount: cartLines.reduce((n, l) => n + l.qty, 0),
      now, outletId, setOutletId, tableOutlet, setTableOutlet,
      isOpen: isOpenNow(settings, now),
      money: (n) => money(settings, n),
      markPromoUsed: () => write(KEYS.promoUsed, true),
      // The server re-checks prices & promo.
      placeOrder: (order) => api('POST', 'orders', order),
      checkPromo: (code, phone) => api('POST', 'promo/check', { code, phone }),

      cartOpen, setCartOpen, chatOpen, setChatOpen, promoOpen, setPromoOpen,
      promoInput, setPromoInput, promoCode, setPromoCode,
      applyCode: (code) => { setPromoCode(code); setPromoInput(code); },
      checkout, setCheckout,
      menuQuery, setMenuQuery, menuDiet, setMenuDiet, menuJump,
      jumpToCategory: (cat) => setMenuJump((j) => ({ cat, n: (j ? j.n : 0) + 1 })),
      clearMenuFilters: () => { setMenuQuery(''); setMenuDiet('all'); }
    };
  }, [defaults, menu, settings, gallery, cart, now, outletId, setOutletId, tableOutlet, getItem, setCart, cartOpen, chatOpen, promoOpen, promoInput, promoCode, checkout, menuQuery, menuDiet, menuJump]);

  return <SiteCtx.Provider value={value}>{children}</SiteCtx.Provider>;
}
