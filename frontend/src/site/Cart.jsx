/* ==========================================================================
   Cart — drawer, quantities, promo code, totals and WhatsApp checkout,
   plus the floating "View order" bar.
   ========================================================================== */
import { useEffect, useMemo, useRef } from 'react';
import { useSite } from './store.jsx';
import { Link } from './router.jsx';
import { Art, iconFor } from './art.jsx';
import { Icon } from '../shared/Icon.jsx';
import { useToast } from '../shared/toast.jsx';
import { useLayer } from '../shared/layer.js';
import { fmt12 } from '../shared/format.js';

export function CartBar() {
  const site = useSite(), n = site.cartCount;
  const total = site.money(site.totals('').subtotal);
  useEffect(() => { document.body.classList.toggle('has-cart-bar', n > 0); }, [n]);
  return (
    <button type="button" className="cart-bar" id="cartBar" hidden={!n} onClick={() => site.setCartOpen(true)}
      aria-label={'View order: ' + n + ' item' + (n === 1 ? '' : 's') + ', ' + total}>
      <span className="cb-count">{n}</span>
      <span className="cb-label">View order</span>
      <b className="cb-total">{total}</b>
      <Icon name="arrow-right" />
    </button>
  );
}

function CartLine({ line }) {
  const site = useSite();
  const art = useMemo(() => iconFor(line.item), [line.item]);
  return (
    <li className="cart-line">
      <Art className="cl-art" html={art} />
      <div className="cl-info"><b>{line.name}</b><span>{line.label} · {site.money(line.unit)}</span></div>
      <div className="qty" role="group" aria-label={'Quantity for ' + line.name}>
        <button type="button" aria-label="Decrease" onClick={() => site.setQty(line.id, line.label, line.qty - 1)}><Icon name={line.qty === 1 ? 'trash' : 'minus'} /></button>
        <output>{line.qty}</output>
        <button type="button" aria-label="Increase" onClick={() => site.setQty(line.id, line.label, line.qty + 1)}><Icon name="plus" /></button>
      </div>
      <b className="cl-total">{site.money(line.total)}</b>
    </li>
  );
}

export function CartDrawer() {
  const site = useSite(), toast = useToast();
  const { settings: s, cartLines: lines, promoCode, checkout } = site;
  const ref = useRef(null), formRef = useRef(null);
  const close = () => site.setCartOpen(false);
  const { hidden, isOpen } = useLayer(site.cartOpen, ref, { onClose: close });
  const t = site.totals(promoCode);

  const set = (k) => (e) => { e.target.classList.remove('invalid'); site.setCheckout({ ...checkout, [k]: e.target.value }); };
  const applyPromo = () => site.setPromoCode(site.promoInput.trim());

  function submit(e) {
    e.preventDefault();
    const f = formRef.current;
    const data = { name: checkout.name.trim(), phone: checkout.phone.trim(), address: checkout.address.trim() };
    const missing = ['name', 'phone', 'address'].filter((k) => !data[k]);
    [f.name, f.phone, f.address].forEach((i) => i.classList.toggle('invalid', missing.includes(i.name)));
    if (missing.length) return toast('Please fill in your ' + missing.join(', '), 'error');
    if (!/^[+\d][\d\s-]{6,}$/.test(data.phone)) { f.phone.classList.add('invalid'); return toast('Please enter a valid phone number', 'error'); }

    const text = '*New order — ' + s.name + '*\n\n' +
      lines.map((l) => '• ' + l.qty + '× ' + l.name + ' (' + l.label + ') — ' + site.money(l.total)).join('\n') +
      '\n\nSubtotal: ' + site.money(t.subtotal) +
      (t.discount ? '\nPromo ' + promoCode.toUpperCase() + ': −' + site.money(t.discount) : '') +
      '\nDelivery: ' + (t.delivery ? site.money(t.delivery) : 'FREE') +
      '\n*Total: ' + site.money(t.total) + '*' +
      '\n\nName: ' + data.name + '\nPhone: ' + data.phone + '\nAddress: ' + data.address;

    // Record the order on the server (it re-checks prices & promo). WhatsApp opens
    // straight away so the pop-up isn't blocked; a failed save never stops the order.
    site.placeOrder({
      name: data.name, phone: data.phone, address: data.address, code: t.discount ? promoCode : '',
      items: lines.map((l) => ({ id: l.id, label: l.label, qty: l.qty }))
    }).catch((err) => console.warn('Order not saved:', err.message));
    if (t.discount) site.markPromoUsed();

    const wa = String(s.whatsapp || '').replace(/\D/g, '');
    window.open('https://wa.me/' + wa + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
    site.clearCart();
    site.applyCode('');
    site.setCheckout({ name: '', phone: '', address: '' });
    close();
    toast('Order ready. Tap send in WhatsApp to finish.');
  }

  return (
    <>
      <div className={'drawer-backdrop' + (isOpen ? ' is-open' : '')} hidden={hidden} onClick={close} />
      <aside className={'drawer' + (isOpen ? ' is-open' : '')} ref={ref} role="dialog" aria-modal="true" aria-labelledby="cartTitle" hidden={hidden}>
        <header className="drawer-head">
          <h2 id="cartTitle">Your order</h2>
          <button className="icon-btn close-btn" onClick={close} aria-label="Close cart"><Icon name="x" /></button>
        </header>
        <div className="drawer-body">
          {lines.length
            ? <ul className="cart-lines">{lines.map((l) => <CartLine key={l.id + '|' + l.label} line={l} />)}</ul>
            : <div className="empty"><span className="empty-ico"><Icon name="bag" /></span><p>Your order is empty.</p>
                <Link to="/menu" className="btn btn-red btn-sm" onClick={close}>Browse the menu</Link></div>}
        </div>
        <footer className="drawer-foot" hidden={!lines.length}>
          {/* Ordering stays possible while closed, but say when it will be handled. */}
          <p className="closed-note" hidden={site.isOpen}><Icon name="moon" /> <span>We're closed right now. We'll start on your order when we open at {fmt12(s.hoursOpen)}.</span></p>
          <div className="promo-row">
            <input type="text" value={site.promoInput} onChange={(e) => site.setPromoInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyPromo(); } }}
              placeholder="Promo code" aria-label="Promo code" autoComplete="off" />
            <button className="btn btn-outline btn-sm" onClick={applyPromo}>Apply</button>
          </div>
          <p className={'promo-msg ' + (t.discount ? 'ok' : 'bad')} aria-live="polite">{promoCode ? t.promoMsg : ''}</p>
          <dl className="totals">
            <div><dt>Subtotal</dt><dd>{site.money(t.subtotal)}</dd></div>
            {t.discount > 0 && <div className="disc"><dt>Promo {promoCode.toUpperCase()}</dt><dd>− {site.money(t.discount)}</dd></div>}
            <div><dt>Delivery{t.delivery ? <> <small>(free over {site.money(s.freeDeliveryOver)})</small></> : null}</dt><dd>{t.delivery ? site.money(t.delivery) : 'FREE'}</dd></div>
            <div className="grand"><dt>Total</dt><dd>{site.money(t.total)}</dd></div>
          </dl>
          <form className="checkout" ref={formRef} onSubmit={submit} noValidate>
            <input type="text" name="name" value={checkout.name} onChange={set('name')} placeholder="Your name" required autoComplete="name" aria-label="Your name" />
            <input type="tel" name="phone" value={checkout.phone} onChange={set('phone')} placeholder="Phone" required autoComplete="tel" aria-label="Phone" />
            <input type="text" name="address" value={checkout.address} onChange={set('address')} placeholder="Delivery address / table no." required autoComplete="street-address" aria-label="Delivery address" />
            <button type="submit" className="btn btn-red btn-block">Place order via WhatsApp</button>
            <p className="tiny muted">Your order opens in WhatsApp, pre-filled and ready to send.</p>
          </form>
        </footer>
      </aside>
    </>
  );
}
