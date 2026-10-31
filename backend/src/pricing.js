/* ==========================================================================
   Cart totals — the same maths as the browser (public/js/store.js), run on
   the server so stored orders can't be tampered with.
   The promo applies to ONE 22" XL pizza (the priciest one in the cart).
   ========================================================================== */
'use strict';
const { isPizza } = require('./validate');

function cartLines(menu, cart) {
  const byId = new Map(menu.map((m) => [m.id, m]));
  return cart.map((c) => {
    const item = byId.get(c.id);
    if (!item) return null;
    const p = item.prices.find((x) => x.label === c.label);
    if (!p) return null;
    return { id: c.id, label: c.label, qty: c.qty, name: item.name, unit: +p.price, total: +p.price * c.qty, item };
  }).filter(Boolean);
}

// The delivery fee is a range the outlet confirms on WhatsApp, so it stays out of the total.
function totals(menu, settings, cart, code) {
  const s = settings, lines = cartLines(menu, cart);
  const subtotal = lines.reduce((n, l) => n + l.total, 0);
  let discount = 0, promoMsg = '';
  if (code) {
    const promoOk = s.promo.enabled && String(code).trim().toUpperCase() === String(s.promo.code).toUpperCase();
    if (!promoOk) promoMsg = 'That code is not valid.';
    else {
      const xl = lines.filter((l) => isPizza(l.item.category) && /22/.test(l.label))
        .sort((a, b) => b.unit - a.unit)[0];
      if (!xl) promoMsg = 'Add a 22" XL pizza to use this code.';
      else { discount = Math.round(xl.unit * s.promo.percent / 100); promoMsg = s.promo.percent + '% off your 22" ' + xl.name + '!'; }
    }
  }
  return { lines, subtotal, discount, delivery: 0, total: subtotal - discount, promoMsg };
}

module.exports = { cartLines, totals };
