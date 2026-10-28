/* Outlets — the branches shown in Find us. Customers pick one when they
   order, and the WhatsApp order goes to that outlet's number. */
import { useEffect, useRef, useState } from 'react';
import { useAdmin } from './store.jsx';
import { useConfirm } from './confirm.jsx';
import { Icon } from '../shared/Icon.jsx';
import { useToast } from '../shared/toast.jsx';
import { useLayer } from '../shared/layer.js';
import { fmt12 } from '../shared/format.js';
import { mapHref, outletWhatsApp } from '../shared/outlets.js';

const BLANK = { id: '', name: '', area: '', address: '', landmark: '', phones: [], whatsapp: '', delivery: '', hoursOpen: '', hoursClose: '', mapsUrl: '', lat: null, lng: null, instagram: '', facebook: '', main: false, active: true };
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

export function OutletsPanel({ hidden }) {
  const admin = useAdmin(), toast = useToast(), confirm = useConfirm();
  const s = admin.settings, outlets = s.outlets || [];
  const [editor, setEditor] = useState(null); // { outlet, index, open, n }

  const save = (list, msg) => admin.saveSettings({ ...s, outlets: list }).then((ok) => { if (ok && msg) toast(msg); return ok; });
  const open = (outlet, index) => setEditor((e) => ({ outlet, index, open: true, n: (e ? e.n : 0) + 1 }));

  function move(i, d) {
    const list = outlets.slice();
    [list[i], list[i + d]] = [list[i + d], list[i]];
    save(list);
  }
  function makeMain(i) { save(outlets.map((o, k) => ({ ...o, main: k === i })), outlets[i].name + ' is now the main branch'); }
  function toggle(i, on) { save(outlets.map((o, k) => (k === i ? { ...o, active: on } : o)), outlets[i].name + (on ? ' is visible again' : ' is hidden from the site')); }
  async function remove(i) {
    if (await confirm('Delete the ' + outlets[i].name + ' outlet? Past orders keep its name.', 'Delete')) save(outlets.filter((_, k) => k !== i), 'Outlet deleted');
  }

  const visible = outlets.filter((o) => o.active).length;
  return (
    <div className="admin-panel" hidden={hidden}>
      <div className="panel-head outlets-head">
        <div>
          <h2><Icon name="store" /> Outlets</h2>
          <p className="muted tiny">After adding or changing an outlet, tap <b>Test WhatsApp</b> and check the message reaches that outlet's phone: a wrong number means its orders go nowhere. Shown in <b>Find us</b>. With more than one visible outlet, customers choose one after tapping <i>Place order</i>, and the order opens in that outlet's WhatsApp.</p>
        </div>
        <button className="btn btn-red btn-sm" onClick={() => open(null, -1)}><Icon name="plus" /> Add outlet</button>
      </div>
      {!outlets.length && <p className="empty-row panel-card">No outlets yet. The site uses the phone, WhatsApp and address from <b>Store</b> settings until you add one.</p>}
      {outlets.length > 0 && !visible && <p className="admin-alert" role="alert"><Icon name="alert" /> Every outlet is hidden, so the site falls back to the Store settings contact.</p>}
      <ul className="outlet-admin-list">
        {outlets.map((o, i) => (
          <li key={o.id} className={'panel-card outlet-admin' + (o.active ? '' : ' row-off')}>
            <div className="oa-main">
              <div className="oa-title">
                <b>{o.name}</b>{o.area && <span className="muted"> · {o.area}</span>}
                {o.main && <span className="outlet-tag">Main</span>}
                {!o.active && <span className="oa-hidden">Hidden</span>}
              </div>
              <p className="tiny">{o.address}{o.landmark && <span className="muted"> — {o.landmark}</span>}</p>
              <p className="tiny oa-facts">
                <span><Icon name="phone" /> {o.phones.join(' / ') || '—'}</span>
                <span><Icon name="whatsapp" /> {o.whatsapp ? '+' + o.whatsapp : <em className="warn">uses the Store WhatsApp number</em>}</span>
                <span><Icon name="clock" /> {o.hoursOpen ? fmt12(o.hoursOpen) + ' – ' + fmt12(o.hoursClose) : 'Store hours'}</span>
                {o.delivery && <span><Icon name="bike" /> {o.delivery}</span>}
                <a href={mapHref(o, s)} target="_blank" rel="noopener"><Icon name="route" /> Map</a>
                {o.lat == null && <em className="warn">no map pin</em>}
              </p>
            </div>
            <div className="oa-actions">
              {outletWhatsApp(o, s) && (
                <a className="btn btn-outline btn-sm" target="_blank" rel="noopener" title="Opens WhatsApp with a test message to this outlet's number. Send it, then check it arrived on the outlet's phone."
                  href={'https://wa.me/' + outletWhatsApp(o, s) + '?text=' + encodeURIComponent('Test from the ' + s.name + ' website: online orders for ' + o.name + ' will arrive in this chat. Please reply OK if you got this.')}>
                  <Icon name="whatsapp" /> Test WhatsApp
                </a>
              )}
              <label className="switch switch-sm" title="Visible on the site"><input type="checkbox" checked={o.active} onChange={(e) => toggle(i, e.target.checked)} aria-label={'Visible: ' + o.name} /><span /></label>
              {!o.main && <button type="button" className="btn btn-link btn-sm" onClick={() => makeMain(i)}>Make main</button>}
              <button type="button" className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label={'Move ' + o.name + ' up'}><Icon name="arrow-up" /></button>
              <button type="button" className="icon-btn" disabled={i === outlets.length - 1} onClick={() => move(i, 1)} aria-label={'Move ' + o.name + ' down'}><Icon name="arrow-down" /></button>
              <button type="button" className="icon-btn" onClick={() => open(o, i)} aria-label={'Edit ' + o.name}><Icon name="pencil" /></button>
              <button type="button" className="icon-btn danger" onClick={() => remove(i)} aria-label={'Delete ' + o.name}><Icon name="trash" /></button>
            </div>
          </li>
        ))}
      </ul>
      <OutletEditor state={editor} outlets={outlets} onClose={() => setEditor((e) => ({ ...e, open: false }))}
        onSave={(o, index) => {
          let list = index < 0 ? [...outlets, o] : outlets.map((x, k) => (k === index ? o : x));
          if (o.main) list = list.map((x) => (x === o ? x : { ...x, main: false }));
          return save(list, 'Saved ' + o.name);
        }} />
    </div>
  );
}

function OutletEditor({ state, outlets, onClose, onSave }) {
  const ref = useRef(null);
  const open = !!(state && state.open);
  const { hidden, isOpen } = useLayer(open, ref, { onClose, focus: '[name=name]' });
  const [f, setF] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    const o = state.outlet || BLANK;
    setF({ ...BLANK, ...o, phones: (o.phones || []).join(', '), pin: o.lat != null ? o.lat + ', ' + o.lng : '', isNew: !state.outlet, main: state.outlet ? o.main : !outlets.length });
    setErr('');
  }, [state && state.n]); // eslint-disable-line react-hooks/exhaustive-deps

  const field = (k, extra) => ({ name: k, value: f[k], onChange: (e) => setF((x) => ({ ...x, [k]: e.target.value })), ...extra });

  async function submit(e) {
    e.preventDefault();
    const name = f.name.trim();
    if (!name) { setErr('Give the outlet a name, e.g. the area it is in.'); return; }
    const id = f.id || slug(name) || 'outlet';
    if (f.isNew && outlets.some((o) => o.id === id)) { setErr('There is already an outlet called ' + name + '.'); return; }
    if ((f.hoursOpen || f.hoursClose) && !(f.hoursOpen && f.hoursClose)) { setErr('Set both opening and closing time, or leave both empty to use the store hours.'); return; }
    const pin = f.pin.trim() ? f.pin.split(/[,\s]+/).filter(Boolean).map(Number) : [null, null];
    if (pin.length !== 2 || (f.pin.trim() && !pin.every(Number.isFinite))) { setErr('Map pin: paste two numbers, latitude then longitude, e.g. 27.6795, 85.308.'); return; }
    const { isNew, pin: _pin, ...rest } = f; // eslint-disable-line no-unused-vars
    const out = { ...rest, id, name, lat: pin[0], lng: pin[1], phones: f.phones.split(/[,/]/).map((p) => p.trim()).filter(Boolean), whatsapp: String(f.whatsapp).replace(/\D/g, '') };
    if (await onSave(out, state.index)) onClose();
  }

  return (
    <div className={'modal' + (isOpen ? ' is-open' : '')} ref={ref} role="dialog" aria-modal="true" aria-labelledby="outletTitle" hidden={hidden}>
      <div className="modal-backdrop" onClick={onClose} />
      {f && (
        <form className="modal-card item-card" onSubmit={submit} noValidate>
          <button type="button" className="icon-btn close-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
          <h2 id="outletTitle">{f.isNew ? 'Add outlet' : 'Edit ' + f.name}</h2>
          <div className="field-row">
            <label className="field"><span>Name</span><input {...field('name', { required: true, maxLength: 40, placeholder: 'e.g. Jhamsikhel' })} /></label>
            <label className="field"><span>Area / city</span><input {...field('area', { maxLength: 60, placeholder: 'e.g. Lalitpur' })} /></label>
          </div>
          <label className="field"><span>Address</span><input {...field('address', { maxLength: 160 })} /></label>
          <label className="field"><span>How to find it <em>(landmark)</em></span><textarea rows="2" {...field('landmark', { maxLength: 200, placeholder: 'e.g. Opposite Vesper Cafe' })} /></label>
          <div className="field-row">
            <label className="field"><span>Phone numbers <em>(comma between)</em></span><input type="tel" {...field('phones', { placeholder: '+977 984-1336695, +977 ...' })} /></label>
            <label className="field"><span>WhatsApp for orders <em>(with 977)</em></span><input inputMode="numeric" {...field('whatsapp', { placeholder: '9779841336695' })} /></label>
          </div>
          <label className="field"><span>Delivery note</span><input {...field('delivery', { maxLength: 120, placeholder: 'e.g. Delivers across Lalitpur' })} /></label>
          <div className="field-row">
            <label className="field"><span>Opens <em>(empty = store hours)</em></span><input type="time" {...field('hoursOpen')} /></label>
            <label className="field"><span>Closes</span><input type="time" {...field('hoursClose')} /></label>
          </div>
          <div className="field-row">
            <label className="field"><span>Google Maps link</span><input type="url" {...field('mapsUrl', { placeholder: 'https://maps.app.goo.gl/...' })} /></label>
            <label className="field"><span>Map pin <em>(latitude, longitude)</em></span><input inputMode="decimal" {...field('pin', { placeholder: '27.6795, 85.308' })} /></label>
          </div>
          <p className="tiny muted">For the pin: right-click the outlet in Google Maps and click the numbers at the top to copy them, then paste here.</p>
          <div className="field-row">
            <label className="field"><span>Instagram link</span><input type="url" {...field('instagram', { placeholder: 'https://www.instagram.com/...' })} /></label>
            <label className="field"><span>Facebook link</span><input type="url" {...field('facebook', { placeholder: 'https://www.facebook.com/...' })} /></label>
          </div>
          <div className="field-row">
            <label className="switch"><input type="checkbox" checked={f.active} onChange={(e) => setF((x) => ({ ...x, active: e.target.checked }))} /><span /> Visible on the site</label>
            <label className="switch"><input type="checkbox" checked={f.main} onChange={(e) => setF((x) => ({ ...x, main: e.target.checked }))} /><span /> Main branch</label>
          </div>
          <p className="form-error" aria-live="assertive">{err}</p>
          <div className="modal-actions">
            <button type="button" className="btn btn-link" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-red">Save outlet</button>
          </div>
        </form>
      )}
    </div>
  );
}
