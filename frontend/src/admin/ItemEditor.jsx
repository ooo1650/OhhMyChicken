/* Add / edit / duplicate a menu item. */
import { useEffect, useRef, useState } from 'react';
import { useAdmin } from './store.jsx';
import { Icon } from '../shared/Icon.jsx';
import { useToast } from '../shared/toast.jsx';
import { useLayer } from '../shared/layer.js';
import { PIZZA_CATEGORIES } from '../shared/format.js';
import { Photo } from '../shared/Photo.jsx';
import { PhotoPicker } from './PhotosPanel.jsx';
import { Art } from '../site/art.jsx';
import { ART_GROUPS, artKey, artLabel, artSvg } from '../shared/food-art.js';

// Picture groups to list first for each category.
const ART_FIRST = { nonveg: ['Pizza'], veg: ['Pizza'], porkbuff: ['Pizza'], special: ['Chicken'], momo: ['MoMo', 'Sides & add-ons'], drinks: ['Coffee', 'Tea & hot drinks', 'Cold drinks'] };

let rowKey = 0;
const row = (label, price) => ({ key: ++rowKey, label: label || '', price: price == null ? '' : String(price) });

/** state: { item, copy, pick, open, n } — `n` changes on every open; pick: true opens the photo picker, 'art' the picture list. */
export function ItemEditor({ state, defaultCat, onClose }) {
  const admin = useAdmin(), toast = useToast();
  const sizes = admin.defaults.SIZES;
  const ref = useRef(null);
  const open = !!(state && state.open);
  const { hidden, isOpen } = useLayer(open, ref, { onClose, focus: '[name=name]' });
  const [f, setF] = useState(null);
  const [err, setErr] = useState('');
  const [picking, setPicking] = useState(false);
  const [artOpen, setArtOpen] = useState(false);

  // Fill the form each time the editor opens.
  useEffect(() => {
    if (!open) return;
    const item = state.item, copy = state.copy;
    const d = item ? JSON.parse(JSON.stringify(item)) : { name: '', category: defaultCat !== 'all' ? defaultCat : 'nonveg', diet: 'chicken', desc: '', prices: [], available: true, popular: false, noDelivery: false };
    if (copy) { d.id = ''; d.name += ' (copy)'; }
    let prices = d.prices.map((p) => row(p.label, p.price));
    if (!prices.length && PIZZA_CATEGORIES.includes(d.category)) prices = sizes.map((s) => row(s.label, ''));
    if (!prices.length) prices = [row('Regular', '')];
    setF({ id: d.id || '', imageId: d.imageId || null, image: d.image || null, art: d.art || '', name: d.name, category: d.category, diet: d.diet, desc: d.desc || '', available: d.available !== false, popular: !!d.popular, noDelivery: !!d.noDelivery, prices, title: item && !copy ? 'Edit ' + item.name : 'Add menu item' });
    setErr('');
    setPicking(state.pick === true);
    setArtOpen(state.pick === 'art');
  }, [state && state.n]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus the name once the freshly filled form is on screen.
  const filled = f && open ? state.n : null;
  useEffect(() => {
    if (filled == null) return undefined;
    const raf = requestAnimationFrame(() => { const el = ref.current.querySelector('[name=name]'); if (el) el.focus({ preventScroll: true }); });
    return () => cancelAnimationFrame(raf);
  }, [filled]);

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setPrice = (key, k, v) => setF((x) => ({ ...x, prices: x.prices.map((p) => (p.key === key ? { ...p, [k]: v } : p)) }));

  // Switching category while prices are still blank swaps in sensible variant rows.
  function changeCategory(cat) {
    setF((x) => {
      const blank = x.prices.every((p) => p.price === '');
      const prices = !blank ? x.prices : PIZZA_CATEGORIES.includes(cat) ? sizes.map((s) => row(s.label, '')) : [row('Regular', '')];
      return { ...x, category: cat, prices };
    });
  }
  function addRow() {
    setF((x) => ({ ...x, prices: [...x.prices, row('', '')] }));
    setTimeout(() => { const all = ref.current.querySelectorAll('.pr-label'); all[all.length - 1].focus(); }, 0);
  }
  function pizzaSizes() {
    setF((x) => {
      const existing = {};
      x.prices.forEach((p) => { existing[p.label.trim()] = p.price; });
      return { ...x, prices: sizes.map((s) => row(s.label, existing[s.label] || '')) };
    });
  }
  function removeRow(key) {
    if (f.prices.length === 1) { toast('An item needs at least one price', 'error'); return; }
    setF((x) => ({ ...x, prices: x.prices.filter((p) => p.key !== key) }));
  }

  function save(e) {
    e.preventDefault();
    const name = f.name.trim();
    const prices = f.prices.map((p) => ({ label: p.label.trim(), price: p.price })).filter((p) => p.label || p.price !== '');
    if (!name) { setErr('Please enter a name.'); ref.current.querySelector('[name=name]').focus(); return; }
    if (!prices.length) { setErr('Add at least one price.'); return; }
    for (const p of prices) {
      if (!p.label) { setErr('Every price needs a label.'); return; }
      if (p.price === '' || isNaN(+p.price) || +p.price < 0) { setErr('Price for “' + p.label + '” must be 0 or more.'); return; }
      p.price = Math.round(+p.price);
    }
    const labels = prices.map((p) => p.label.toLowerCase());
    if (labels.some((l, i) => labels.indexOf(l) !== i)) { setErr('Variant labels must be unique.'); return; }
    const dupe = admin.menu.find((m) => m.name.toLowerCase() === name.toLowerCase() && m.id !== f.id);
    if (dupe) { setErr('An item called “' + dupe.name + '” already exists.'); return; }

    const saved = admin.upsertItem({ id: f.id, name, category: f.category, diet: f.diet, desc: f.desc.trim(), prices, available: f.available, popular: f.popular, noDelivery: f.noDelivery, imageId: f.imageId, image: f.image, art: f.art });
    onClose();
    toast('Saved “' + saved.name + '”');
  }

  return (
    <>
    <div className={'modal' + (isOpen ? ' is-open' : '')} ref={ref} role="dialog" aria-modal="true" aria-labelledby="itemModalTitle" hidden={hidden}>
      <div className="modal-backdrop" onClick={onClose} />
      {f && (
        <form className="modal-card item-card" onSubmit={save} noValidate>
          <button type="button" className="icon-btn close-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
          <h2 id="itemModalTitle">{f.title}</h2>
          <label className="field"><span>Name</span><input name="name" value={f.name} onChange={(e) => set('name', e.target.value)} required maxLength="60" /></label>
          <div className="field-row">
            <label className="field"><span>Category</span>
              <select value={f.category} onChange={(e) => changeCategory(e.target.value)}>
                {admin.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="field"><span>Type</span>
              <select value={f.diet} onChange={(e) => set('diet', e.target.value)}>
                <option value="veg">Veg</option>
                <option value="chicken">Chicken</option>
                <option value="fish">Fish</option>
                <option value="buff">Buff</option>
                <option value="pork">Pork</option>
                <option value="mix">Mixed meat</option>
              </select>
            </label>
          </div>
          <div className="field">
            <span>Photo</span>
            <div className="item-photo">
              {f.image
                ? <Photo media={f.image} alt="" sizes="96px" />
                : <span className="item-photo-empty"><Icon name="pizza" /></span>}
              <div className="item-photo-actions">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setPicking(true)}><Icon name="upload" /> {f.image ? 'Change photo' : 'Add photo'}</button>
                {f.image && <button type="button" className="btn btn-link btn-sm danger" onClick={() => setF((x) => ({ ...x, imageId: null, image: null }))}>Remove</button>}
                {!f.image && <p className="tiny muted">Without a photo the dish shows its drawing.</p>}
              </div>
            </div>
          </div>
          <ArtField f={f} open={artOpen} setOpen={setArtOpen} onPick={(key) => { set('art', key); setArtOpen(false); }} />
          <label className="field"><span>Description</span><textarea rows="2" maxLength="140" value={f.desc} onChange={(e) => set('desc', e.target.value)} /></label>
          <div className="field">
            <span>Prices / variants</span>
            <div className="price-rows">
              {f.prices.map((p) => (
                <div className="price-row" key={p.key}>
                  <input type="text" className="pr-label" placeholder='Label (e.g. 22" XL)' value={p.label} onChange={(e) => setPrice(p.key, 'label', e.target.value)} aria-label="Variant label" maxLength="20" />
                  <input type="number" className="pr-price" placeholder="Price" min="0" step="10" value={p.price} onChange={(e) => setPrice(p.key, 'price', e.target.value)} aria-label="Price" />
                  <button type="button" className="icon-btn danger" aria-label="Remove variant" onClick={() => removeRow(p.key)}><Icon name="x" /></button>
                </div>
              ))}
            </div>
            <div className="price-actions">
              <button type="button" className="btn btn-link btn-sm" onClick={addRow}><Icon name="plus" /> Add variant</button>
              <button type="button" className="btn btn-link btn-sm" onClick={pizzaSizes}><Icon name="pizza" /> Use pizza sizes</button>
            </div>
          </div>
          <div className="field-row">
            <label className="switch"><input type="checkbox" checked={f.available} onChange={(e) => set('available', e.target.checked)} /><span /> Available</label>
            <label className="switch"><input type="checkbox" checked={f.popular} onChange={(e) => set('popular', e.target.checked)} /><span /> Featured</label>
            <label className="switch" title="Stays on the menu for table orders and pickup"><input type="checkbox" checked={f.noDelivery} onChange={(e) => set('noDelivery', e.target.checked)} /><span /> Not for delivery</label>
          </div>
          <p className="form-error" aria-live="assertive">{err}</p>
          <div className="modal-actions">
            <button type="button" className="btn btn-link" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-red">Save item</button>
          </div>
        </form>
            )}
    </div>
    <PhotoPicker open={picking} selected={f && f.imageId} onClose={() => setPicking(false)}
      onPick={(m) => { setF((x) => x && { ...x, imageId: m.id, image: m }); setPicking(false); }} />
    </>
  );
}

// The drawing shown for the dish (and behind a photo while it loads). '' = picked from the name.
function ArtField({ f, open, setOpen, onPick }) {
  const sample = { name: f.name, diet: f.diet, category: f.category, isPizza: PIZZA_CATEGORIES.includes(f.category) };
  const auto = artKey(sample);
  const first = ART_FIRST[f.category] || [];
  const groups = [...ART_GROUPS].sort((a, b) => (first.includes(a.group) ? first.indexOf(a.group) : 99) - (first.includes(b.group) ? first.indexOf(b.group) : 99));
  const tile = (key, label, chosen) => (
    <button type="button" key={key || 'auto'} className={'art-tile' + (chosen ? ' on' : '')} aria-pressed={chosen} onClick={() => onPick(key)}>
      <Art html={artSvg({ ...sample, art: key })} className="art-tile-img" />
      <span>{label}</span>
    </button>
  );
  return (
    <div className="field">
      <span>Drawing <em>(shown when there is no photo)</em></span>
      <div className="item-art">
        <Art html={artSvg({ ...sample, art: f.art })} className="item-art-now" />
        <div className="item-photo-actions">
          <b>{artLabel(f.art || auto)}</b>
          <p className="tiny muted">{f.art ? 'Chosen for this dish.' : 'Picked automatically from the name.'}</p>
          <button type="button" className="btn btn-outline btn-sm" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Close list' : 'Choose picture'}</button>
        </div>
      </div>
      {open && (
        <div className="art-picker">
          <div className="art-grid">{tile('', 'Automatic', !f.art)}</div>
          {groups.map((g) => (
            <div key={g.group}>
              <p className="art-group">{g.group}</p>
              <div className="art-grid">{g.items.map((it) => tile(it.key, it.label, f.art === it.key))}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
