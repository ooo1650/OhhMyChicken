/* ==========================================================================
   Cart — drawer, quantities, promo code, totals and WhatsApp checkout
   (with several outlets, the customer then picks the one to send it to),
   plus the floating "View order" bar.
   ========================================================================== */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSite } from './store.jsx';
import { Link } from './router.jsx';
import { Art, iconFor } from './art.jsx';
import { Icon } from '../shared/Icon.jsx';
import { Photo } from '../shared/Photo.jsx';
import { useToast } from '../shared/toast.jsx';
import { useLayer } from '../shared/layer.js';
import { fmt12 } from '../shared/format.js';
import { track } from '../shared/track.js';
import { outletList, outletOpen, outletWhatsApp, outletTitle, telHref } from '../shared/outlets.js';

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
  const photo = site.settings.dishPhotos ? line.item.image : null;
  const art = useMemo(() => (photo ? '' : iconFor(line.item)), [line.item, photo]);
  return (
    <li className="cart-line">
      {photo
        ? <div className="cl-art has-photo"><Photo media={photo} alt="" sizes="46px" /></div>
        : <Art className="cl-art" html={art} />}
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
  // The promo is once per phone number: ask the server as soon as a phone is typed.
  const phoneDigits = checkout.phone.replace(/\D/g, '').slice(-10);
  const promoKey = promoCode.toUpperCase() + '|' + phoneDigits;
  const [usedKey, setUsedKey] = useState('');
  // How the order is served decides what we ask for: an address only for delivery,
  // a table number at a table, nothing for pickup. Name and phone are optional.
  const mode = checkout.mode || 'delivery';
  const MODES = [['delivery', 'Delivery', 'bike']].concat(s.dineIn ? [['table', 'At my table', 'utensils']] : [], s.takeaway ? [['pickup', 'Pickup', 'bag']] : []);
  const withPromo = site.totals(promoCode, mode);
  const t = usedKey === promoKey ? { ...site.totals('', mode), promoMsg: 'This code was already used with this phone number.' } : withPromo;
  useEffect(() => {
    if (!promoCode || !withPromo.discount || phoneDigits.length < 7) return undefined;
    const timer = setTimeout(() => site.checkPromo(promoCode, checkout.phone).then((r) => { if (r.used) setUsedKey(promoKey); }, () => {}), 600);
    return () => clearTimeout(timer);
  }, [promoKey, withPromo.discount > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (site.cartOpen) track('cart_open'); }, [site.cartOpen]);
  useEffect(() => { if (t.discount > 0) track('promo_applied', { value: promoCode }); }, [t.discount > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => { e.target.classList.remove('invalid'); site.setCheckout({ ...checkout, [k]: e.target.value }); };
  const applyPromo = () => site.setPromoCode(site.promoInput.trim());

  // 'form' → (several outlets) 'outlet': choose where the WhatsApp order goes.
  const [step, setStep] = useState('form');
  useEffect(() => { if (!site.cartOpen) setStep('form'); }, [site.cartOpen]);
  const outlets = outletList(s);

  const detailsOf = () => ({ name: checkout.name.trim(), phone: checkout.phone.trim(), address: checkout.address.trim(), table: String(checkout.table || '').trim() });

  function details() {
    const f = formRef.current, data = detailsOf();
    const bad = (input, msg) => { if (input) { input.classList.add('invalid'); input.focus(); } toast(msg, 'error'); return null; };
    [f.address, f.table, f.name, f.phone].forEach((i) => i && i.classList.remove('invalid'));
    if (mode === 'delivery' && !data.address) return bad(f.address, 'Please enter your delivery address');
    if (mode === 'table' && !/^[\w-]{1,6}$/.test(data.table)) return bad(f.table, 'Please enter your table number');
    if (data.phone && !/^[+\d][\d\s-]{6,}$/.test(data.phone)) return bad(f.phone, 'Check the phone number, or leave it empty');
    if (t.discount && !data.name) return bad(f.name, 'Add your name to use the promo code');
    if (t.discount && !data.phone) return bad(f.phone, 'Add your phone number to use the promo code (once per number)');
    return data;
  }

  function submit(e) {
    e.preventDefault();
    if (!details()) return;
    // A table QR names its outlet; otherwise ask when there is a choice.
    const fixed = outlets.find((o) => o.id && o.id === site.tableOutlet);
    if (fixed || outlets.length === 1) send(fixed || outlets[0]);
    else setStep('outlet');
  }

  function send(outlet) {
    const data = detailsOf();
    const served = mode === 'table' ? 'Table: ' + data.table + ' (dine-in)' : mode === 'pickup' ? 'Pickup at the outlet' : 'Deliver to: ' + data.address;
    const text = '*New order — ' + s.name + (outlet.single ? '' : ' (' + outlet.name + ')') + '*\n\n' +
      lines.map((l) => '• ' + l.qty + '× ' + l.name + ' (' + l.label + ') — ' + site.money(l.total)).join('\n') +
      '\n\nSubtotal: ' + site.money(t.subtotal) +
      (t.discount ? '\nPromo ' + promoCode.toUpperCase() + ': −' + site.money(t.discount) : '') +
      (mode === 'delivery' ? '\nDelivery: ' + (t.delivery ? site.money(t.delivery) : 'FREE') : '') +
      '\n*Total: ' + site.money(t.total) + '*' +
      '\n\n' + served + (data.name ? '\nName: ' + data.name : '') + (data.phone ? '\nPhone: ' + data.phone : '') +
      (outlet.single ? '' : '\nOutlet: ' + outletTitle(outlet));

    // Record the order on the server (it re-checks prices & promo). WhatsApp opens
    // straight away so the pop-up isn't blocked; a failed save never stops the order.
    track('checkout_submit', { num: t.total, value: outlet.id || null });
    site.placeOrder({
      mode, table: data.table, saveDetails: !!(checkout.saveDetails && data.phone), name: data.name, phone: data.phone, address: mode === 'delivery' ? data.address : '', code: t.discount ? promoCode : '', outlet: outlet.id,
      items: lines.map((l) => ({ id: l.id, label: l.label, qty: l.qty }))
    }).catch((err) => console.warn('Order not saved:', err.message));
    if (t.discount) site.markPromoUsed();
    if (outlet.id) site.setOutletId(outlet.id);

    window.open('https://wa.me/' + outletWhatsApp(outlet, s) + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
    site.clearCart();
    site.applyCode('');
    site.setCheckout({ mode, table: mode === 'table' ? data.table : '', name: '', phone: '', address: '', saveDetails: false }); // at a table, the next order is from the same table
    close();
    toast('Order ready. Tap send in WhatsApp to finish.');
  }

  return (
    <>
      <div className={'drawer-backdrop' + (isOpen ? ' is-open' : '')} hidden={hidden} onClick={close} />
      <aside className={'drawer' + (isOpen ? ' is-open' : '')} ref={ref} role="dialog" aria-modal="true" aria-labelledby="cartTitle" hidden={hidden}>
        <header className="drawer-head">
          {step === 'outlet'
            ? <button type="button" className="icon-btn" onClick={() => setStep('form')} aria-label="Back to your order"><Icon name="arrow-right" className="flip" /></button>
            : null}
          <h2 id="cartTitle">{step === 'outlet' ? 'Choose an outlet' : 'Your order'}</h2>
          <button className="icon-btn close-btn" onClick={close} aria-label="Close cart"><Icon name="x" /></button>
        </header>
        <div className="drawer-body" hidden={step === 'outlet'}>
          {lines.length
            ? <ul className="cart-lines">{lines.map((l) => <CartLine key={l.id + '|' + l.label} line={l} />)}</ul>
            : <div className="empty"><span className="empty-ico"><Icon name="bag" /></span><p>Your order is empty.</p>
                <Link to="/menu" className="btn btn-red btn-sm" onClick={close}>Browse the menu</Link></div>}
        </div>
        {step === 'outlet' && (
          <div className="drawer-body outlet-pick">
            <p className="outlet-pick-intro">Which outlet should make your order? It opens in that outlet's WhatsApp, ready to send. Pick the one nearest you.</p>
            <ul>
              {outlets.map((o) => {
                const open = outletOpen(o, s, site.now), last = o.id === site.outletId;
                return (
                  <li key={o.id}>
                    <div className={'outlet-opt' + (last ? ' is-last' : '')}>
                      <button type="button" className="oo-main" onClick={() => send(o)}>
                        <span className="outlet-ico" aria-hidden="true"><Icon name="store" /></span>
                        <span className="oo-text">
                          <b>{outletTitle(o)}{last && <em>Last used</em>}</b>
                          {o.delivery && <small>{o.delivery}</small>}
                          <small className={open ? 'oo-open' : 'oo-closed'}>{open ? 'Open now' : 'Closed now: they start when they open'}</small>
                        </span>
                        <span className="oo-go" aria-label="Order on WhatsApp"><Icon name="whatsapp" /></span>
                      </button>
                      {o.phones[0] && <a className="oo-call" href={telHref(o.phones[0])}><Icon name="phone" /> No WhatsApp? Call {o.phones[0]}</a>}
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="tiny muted">Your total is {site.money(t.total)}. Nothing is sent until you tap send in WhatsApp. No WhatsApp on this device? Call the outlet and read out your order.</p>
          </div>
        )}
        <footer className="drawer-foot" hidden={!lines.length || step === 'outlet'}>
          {/* Ordering stays possible while closed, but say when it will be handled. */}
          <p className="closed-note" hidden={site.isOpen}><Icon name="moon" /> <span>We're closed right now. We'll start on your order when we open at {fmt12(s.hoursOpen)}.</span></p>
          <div className="promo-row">
            <input type="text" value={site.promoInput} onChange={(e) => site.setPromoInput(e.target.value)} maxLength="20"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyPromo(); } }}
              placeholder="Promo code" aria-label="Promo code" autoComplete="off" />
            <button className="btn btn-outline btn-sm" onClick={applyPromo}>Apply</button>
          </div>
          <p className={'promo-msg ' + (t.discount ? 'ok' : 'bad')} aria-live="polite">{promoCode ? t.promoMsg : ''}</p>
          <dl className="totals">
            <div><dt>Subtotal</dt><dd>{site.money(t.subtotal)}</dd></div>
            {t.discount > 0 && <div className="disc"><dt>Promo {promoCode.toUpperCase()}</dt><dd>− {site.money(t.discount)}</dd></div>}
            {mode === 'delivery' && <div><dt>Delivery{t.delivery ? <> <small>(free over {site.money(s.freeDeliveryOver)})</small></> : null}</dt><dd>{t.delivery ? site.money(t.delivery) : 'FREE'}</dd></div>}
            <div className="grand"><dt>Total</dt><dd>{site.money(t.total)}</dd></div>
          </dl>
          <form className="checkout" ref={formRef} onSubmit={submit} noValidate>
            {MODES.length > 1 && (
              <div className="order-mode" role="radiogroup" aria-label="How would you like it?">
                {MODES.map(([id, label, icon]) => (
                  <button key={id} type="button" role="radio" aria-checked={mode === id} className={mode === id ? 'on' : ''}
                    onClick={() => site.setCheckout({ ...checkout, mode: id })}><Icon name={icon} />{label}</button>
                ))}
              </div>
            )}
            {mode === 'delivery' && <input type="text" name="address" value={checkout.address} onChange={set('address')} placeholder="Delivery address: area, street, landmark" required maxLength="200" autoComplete="street-address" aria-label="Delivery address" />}
            {mode === 'table' && <input type="text" name="table" value={checkout.table || ''} onChange={set('table')} placeholder="Table number" required maxLength="6" inputMode="numeric" aria-label="Table number" />}
            <div className="checkout-row">
              <input type="text" name="name" value={checkout.name} onChange={set('name')} placeholder={promoCode && withPromo.discount ? 'Name (for the promo)' : 'Name (optional)'} maxLength="80" autoComplete="name" aria-label="Your name, optional" />
              <input type="tel" name="phone" value={checkout.phone} onChange={set('phone')} placeholder={promoCode && withPromo.discount ? 'Phone (for the promo)' : 'Phone (optional)'} maxLength="30" inputMode="tel" autoComplete="tel" aria-label="Phone, optional" />
            </div>
            {promoCode && withPromo.discount > 0 && !(checkout.name.trim() && checkout.phone.trim()) && <p className="tiny muted">The promo needs your name and phone number: it works once per number.</p>}
            {(checkout.name.trim() || checkout.phone.trim()) && (
              <label className="save-details">
                <input type="checkbox" checked={!!checkout.saveDetails} onChange={(e) => site.setCheckout({ ...checkout, saveDetails: e.target.checked })} />
                <span>Keep my name and number for offers and faster orders, until I ask to be removed.</span>
              </label>
            )}
            <p className="privacy-note"><Icon name="shield" /> <span>Name and phone are optional. Your details go only to the outlet you pick and are deleted after {site.defaults.ORDER_DETAILS_DAYS || 90} days unless you ask us to keep them. Never sold.</span></p>
            <button type="submit" className="btn btn-red btn-block"><Icon name="whatsapp" /> Place order via WhatsApp</button>
            <p className="tiny muted">{outlets.length > 1 && !outlets.some((o) => o.id && o.id === site.tableOutlet)
              ? 'Next, pick the outlet nearest you. Your order opens in its WhatsApp, ready to send.'
              : 'Your order opens in WhatsApp, pre-filled and ready to send.'}
              {outlets.length === 1 && outlets[0].phones[0] && <> No WhatsApp? <a href={telHref(outlets[0].phones[0])}>Call {outlets[0].phones[0]}</a>.</>}</p>
          </form>
        </footer>
      </aside>
    </>
  );
}
