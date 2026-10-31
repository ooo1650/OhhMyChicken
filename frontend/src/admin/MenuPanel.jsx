/* ==========================================================================
   Menu manager — KPIs, live search (text and prices), category filter,
   sortable table, availability/featured toggles, item editor, JSON
   import/export and reset.
   ========================================================================== */
import { useRef, useState } from 'react';
import { useAdmin } from './store.jsx';
import { useConfirm } from './confirm.jsx';
import { ItemEditor } from './ItemEditor.jsx';
import { Kpi } from './Kpi.jsx';
import { Icon, DietMark } from '../shared/Icon.jsx';
import { Photo } from '../shared/Photo.jsx';
import { useToast } from '../shared/toast.jsx';
import { dietLabel, PIZZA_CATEGORIES } from '../shared/format.js';

// Supports text, exact/partial price ("650"), comparisons ("<500", ">=1000") and ranges ("500-800").
function matches(item, q, categoryName) {
  if (!q) return true;
  const prices = item.prices.map((p) => +p.price);
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((tok) => {
    let m;
    if ((m = tok.match(/^(<=|>=|<|>)(\d+)$/))) {
      const n = +m[2];
      return prices.some((p) => (m[1] === '<' ? p < n : m[1] === '>' ? p > n : m[1] === '<=' ? p <= n : p >= n));
    }
    if ((m = tok.match(/^(\d+)-(\d+)$/))) return prices.some((p) => p >= +m[1] && p <= +m[2]);
    if (/^\d+$/.test(tok)) return prices.some((p) => String(p).includes(tok));
    const hay = [item.name, item.desc, categoryName(item.category), dietLabel(item.diet), item.available ? 'available' : 'sold out', item.popular ? 'featured' : '',
      item.prices.map((p) => p.label).join(' ')].join(' ').toLowerCase();
    return hay.includes(tok);
  });
}

const minPrice = (i) => Math.min(...i.prices.map((p) => +p.price));

function validMenu(list, cats) {
  return Array.isArray(list) && list.length > 0 && list.every((m) => m && typeof m.name === 'string' && m.name.trim() && cats.includes(m.category) &&
    Array.isArray(m.prices) && m.prices.length && m.prices.every((p) => p && typeof p.label === 'string' && isFinite(+p.price)));
}

export function MenuPanel({ hidden, searchRef }) {
  const admin = useAdmin(), toast = useToast(), confirm = useConfirm();
  const { menu, categories } = admin;
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [sort, setSort] = useState({ by: 'category', dir: 1 });
  const [editor, setEditor] = useState(null); // { item, copy, open, n }
  const fileRef = useRef(null);

  const catOrder = (id) => categories.findIndex((c) => c.id === id);
  const rows = menu.filter((i) => (cat === 'all' || i.category === cat) && matches(i, q.trim(), admin.categoryName));
  rows.sort((a, b) => {
    let r;
    if (sort.by === 'name') r = a.name.localeCompare(b.name);
    else if (sort.by === 'price') r = minPrice(a) - minPrice(b);
    else r = catOrder(a.category) - catOrder(b.category);
    return r * sort.dir;
  });
  const avail = menu.filter((i) => i.available).length;

  const sortBy = (by) => setSort((s) => ({ by, dir: s.by === by ? -s.dir : 1 }));
  const th = (by, label) => (
    <th scope="col" tabIndex={0} aria-sort={sort.by === by ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
      onClick={() => sortBy(by)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sortBy(by); } }}>{label}</th>
  );
  // pick: open straight into the photo picker (from the photo slot in each row).
  const openEditor = (item, copy, pick) => setEditor((e) => ({ item, copy, pick, open: true, n: (e ? e.n : 0) + 1 }));

  function toggleAvailable(item, on) {
    admin.upsertItem({ ...item, available: on });
    toast(on ? item.name + ' is available again' : item.name + ' marked sold out', on ? 'ok' : 'info');
  }
  async function del(item) {
    if (await confirm('Delete “' + item.name + '” from the menu?', 'Delete')) { admin.deleteItem(item.id); toast('Deleted “' + item.name + '”'); }
  }

  /* ---------- Import / export ---------- */
  function exportMenu() {
    const blob = new Blob([JSON.stringify({ menu, settings: admin.settings }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ohh-my-chicken-menu-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function importMenu(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      let data;
      try { data = JSON.parse(reader.result); } catch (x) { toast('That file is not valid JSON', 'error'); return; }
      const list = Array.isArray(data) ? data : data.menu;
      if (!validMenu(list, categories.map((c) => c.id))) { toast('File does not look like an OMC menu export', 'error'); return; }
      if (!(await confirm('Replace the current menu with ' + list.length + ' items from “' + file.name + '”?', 'Replace menu'))) return;
      const saved = await admin.saveMenu(list.map((m, i) => ({
        id: m.id || 'imp' + i + Date.now().toString(36), name: m.name.trim(), category: m.category, diet: m.diet || 'veg', desc: m.desc || '',
        prices: m.prices.map((p) => ({ label: p.label, price: Math.round(+p.price) })),
        available: m.available !== false, popular: !!m.popular, noDelivery: !!m.noDelivery, art: m.art || '', isPizza: PIZZA_CATEGORIES.includes(m.category)
      })));
      if (!saved) return;
      if (data.settings) admin.saveSettings(data.settings);
      toast('Imported ' + list.length + ' items');
    };
    reader.readAsText(file);
  }

  async function reset() {
    if (await confirm('Reset the whole menu to the original defaults? Your edits will be lost.', 'Reset menu')) {
      if (await admin.resetMenu()) toast('Menu reset to defaults');
    }
  }

  return (
    <div className="admin-panel" hidden={hidden}>
      <div className="admin-kpis">
        <Kpi label="Menu items" val={menu.length} />
        <Kpi label="Available" val={avail} />
        <Kpi label="Sold out" val={menu.length - avail} cls={menu.length - avail ? 'warn' : ''} />
        <Kpi label="Featured" val={menu.filter((i) => i.popular).length} />
      </div>
      <div className="admin-toolbar">
        <div className="search-wrap">
          <Icon name="search" />
          <input type="search" ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items or prices…"
            title="Search by name, category or price: 650, <500, >=1000, 500-800" aria-label="Search menu items" autoComplete="off" />
        </div>
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filter by category">
          <option value="all">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.short}</option>)}
        </select>
        <button className="btn btn-red btn-sm" onClick={() => openEditor(null)}><Icon name="plus" /> Add item</button>
      </div>
      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              {th('name', 'Item')}
              {th('category', 'Category')}
              {th('price', 'Prices')}
              <th scope="col">Status</th>
              <th scope="col"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => {
              const c = categories.find((x) => x.id === i.category) || { short: i.category, icon: '' };
              return (
                <tr key={i.id} className={i.available ? '' : 'row-off'}>
                  <td data-label="Item"><div className="cell-item">{i.image
                    ? <button type="button" className="thumb-btn" title="Change photo" aria-label={'Change the photo of ' + i.name} onClick={() => openEditor(i, false, true)}><Photo media={i.image} alt="" sizes="44px" className="cell-thumb" /></button>
                    : <button type="button" className="thumb-btn thumb-add" title="Add a photo" aria-label={'Add a photo of ' + i.name} onClick={() => openEditor(i, false, true)}><Icon name="plus" /><span>Photo</span></button>}
                    <span className="diet"><DietMark diet={i.diet} /></span><div><b>{i.name}</b>{i.noDelivery && <em className="no-del-chip">Not for delivery</em>}{i.desc && <small>{i.desc}</small>}</div></div></td>
                  <td data-label="Category"><span className="cat-pill">{c.icon && <Icon name={c.icon} />}{c.short}</span></td>
                  <td data-label="Prices"><div className="price-chips">{i.prices.map((p) => <span key={p.label}><em>{p.label}</em> {admin.money(p.price)}</span>)}</div></td>
                  <td data-label="Status">
                    <div className="status-cell">
                      <label className="switch switch-sm" title="Available">
                        <input type="checkbox" checked={i.available} onChange={(e) => toggleAvailable(i, e.target.checked)} aria-label={'Available: ' + i.name} /><span />
                      </label>
                      <button type="button" className={'star' + (i.popular ? ' on' : '')} aria-pressed={i.popular} aria-label={'Featured: ' + i.name} title="Featured"
                        onClick={() => admin.upsertItem({ ...i, popular: !i.popular })}><Icon name="star" /></button>
                    </div>
                  </td>
                  <td className="row-actions">
                    <button type="button" className="icon-btn" aria-label={'Edit ' + i.name} title="Edit" onClick={() => openEditor(i)}><Icon name="pencil" /></button>
                    <button type="button" className="icon-btn" aria-label={'Duplicate ' + i.name} title="Duplicate" onClick={() => openEditor(i, true)}><Icon name="copy" /></button>
                    <button type="button" className="icon-btn danger" aria-label={'Delete ' + i.name} title="Delete" onClick={() => del(i)}><Icon name="trash" /></button>
                  </td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan="5" className="empty-row">No items match “{q.trim()}”.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="result-count">{rows.length} of {menu.length} items</p>
      <div className="admin-bulk">
        <button className="btn btn-outline btn-sm" onClick={exportMenu}><Icon name="download" /> Export JSON</button>
        <label className="btn btn-outline btn-sm file-btn"><Icon name="upload" /> Import JSON<input type="file" ref={fileRef} onChange={importMenu} accept="application/json,.json" hidden /></label>
        <button className="btn btn-link btn-sm danger" onClick={reset}>Reset menu to defaults</button>
      </div>
      <ItemEditor state={editor} defaultCat={cat} onClose={() => setEditor((e) => ({ ...e, open: false }))} />
    </div>
  );
}
