/* ==========================================================================
   Insights — what visitors do, from the anonymous analytics (no cookies,
   no IPs; see backend/src/analytics.js). One date range for everything.
   ========================================================================== */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAdmin } from './store.jsx';
import { Kpi } from './Kpi.jsx';
import { Icon } from '../shared/Icon.jsx';

const BAR = 'var(--red)';
const RANGES = [7, 30, 90];
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0) + '%';
const compact = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'K' : String(n));
const dayLabel = (d) => { const [y, m, day] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }); };
const niceMax = (v) => { if (v <= 4) return 4; const p = 10 ** Math.floor(Math.log10(v)); const f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; };

function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(600);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/* ---------- Column chart: one series, one axis, hover + keyboard tooltip ---------- */
function Columns({ data, label, valueName, xLabel = (d) => d.x, height = 170 }) {
  const [ref, W] = useWidth();
  const [tip, setTip] = useState(null);
  const L = 34, R = 8, T = 10, B = 22, plotW = W - L - R, plotH = height - T - B;
  const max = niceMax(Math.max(0, ...data.map((d) => d.y)));
  const band = plotW / data.length, bw = Math.max(2, Math.min(24, band - 2));
  const y = (v) => T + plotH - (v / max) * plotH;
  const every = Math.ceil(data.length / Math.max(2, Math.floor(plotW / 64)));
  const empty = data.every((d) => !d.y);
  const show = (d, i, e) => {
    const box = ref.current.getBoundingClientRect();
    const x = e && e.clientX != null ? e.clientX - box.left : L + band * i + band / 2;
    setTip({ x: Math.min(Math.max(x, 60), W - 60), y: y(d.y), value: d.y, label: xLabel(d) });
  };
  return (
    <div className="chart" ref={ref}>
      <svg width={W} height={height} role="img" aria-label={label}>
        {[0, max / 2, max].map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeWidth="1" />
            <text x={L - 6} y={y(t) + 4} textAnchor="end" className="chart-tick">{compact(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const h = (d.y / max) * plotH, x = L + band * i + (band - bw) / 2, r = Math.min(4, h, bw / 2);
          const top = T + plotH - h;
          return (
            <g key={i}>
              {h > 0 && (
                <path d={`M${x} ${T + plotH}V${top + r}q0 -${r} ${r} -${r}h${bw - 2 * r}q${r} 0 ${r} ${r}V${T + plotH}Z`}
                  fill={BAR} opacity={tip && tip.label === xLabel(d) ? 0.75 : 1} />
              )}
              {/* hit target: the whole band, bigger than the bar */}
              <rect x={L + band * i} y={T} width={band} height={plotH} fill="transparent" tabIndex={0}
                aria-label={xLabel(d) + ': ' + d.y + ' ' + valueName}
                onPointerMove={(e) => show(d, i, e)} onPointerLeave={() => setTip(null)}
                onFocus={() => show(d, i)} onBlur={() => setTip(null)} />
              {i % every === 0 && <text x={L + band * i + band / 2} y={height - 6} textAnchor="middle" className="chart-tick">{xLabel(d)}</text>}
            </g>
          );
        })}
        <line x1={L} x2={W - R} y1={T + plotH} y2={T + plotH} stroke="var(--chart-axis)" strokeWidth="1" />
      </svg>
      {empty && <p className="chart-empty">No data in this period yet.</p>}
      {tip && (
        <div className="chart-tip" style={{ left: tip.x, top: tip.y }}>
          <b>{tip.value.toLocaleString('en-IN')}</b> <span>{valueName}</span>
          <small>{tip.label}</small>
        </div>
      )}
    </div>
  );
}

/* ---------- Horizontal bar list (funnel, devices, …) ---------- */
function BarList({ rows, max, unit }) {
  const top = max || Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="hbars">
      {rows.map((r) => (
        <li key={r.label} title={r.value + ' ' + unit}>
          <span className="hb-label">{r.label}</span>
          <span className="hb-track"><i style={{ width: Math.max(r.value ? 1.5 : 0, (r.value / top) * 100) + '%' }} /></span>
          <b>{r.value.toLocaleString('en-IN')}</b>
          {r.note && <small>{r.note}</small>}
        </li>
      ))}
    </ul>
  );
}

function Table({ head, rows, empty }) {
  if (!rows.length) return <p className="muted tiny">{empty}</p>;
  return (
    <table className="mini-table">
      <thead><tr>{head.map((h, i) => <th key={h} className={i ? 'num' : undefined}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j ? 'num' : undefined}>{c}</td>)}</tr>)}</tbody>
    </table>
  );
}

// Shown until PaperKite switches Insights on for this restaurant.
function InsightsLocked() {
  return (
    <div className="panel-card insights-locked">
      <span className="il-ico" aria-hidden="true"><Icon name="lock" /></span>
      <h2>Insights is a premium feature</h2>
      <p>See how many people visit, what they search for, which dishes they add but don't order, and your busiest hours.</p>
      <p className="il-cta">To use this feature, upgrade your plan. Contact PaperKite:</p>
      <a className="btn btn-red" href="mailto:paperkite.contact@gmail.com?subject=Upgrade%3A%20Insights%20for%20Ohh%20My%20Chicken%20Pizza%20Hub">Contact PaperKite</a>
      <a className="il-mail" href="mailto:paperkite.contact@gmail.com?subject=Upgrade%3A%20Insights%20for%20Ohh%20My%20Chicken%20Pizza%20Hub">paperkite.contact@gmail.com</a>
    </div>
  );
}

export function InsightsPanel({ hidden }) {
  const admin = useAdmin();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (hidden) return;
    setLoading(true);
    admin.loadInsights(days).then((d) => { setData(d); setError(''); }, (e) => { if (e.status === 402) setLocked(true); else setError(e.message); }).finally(() => setLoading(false));
  }, [hidden, days]); // eslint-disable-line react-hooks/exhaustive-deps

  const nameOf = (id) => (admin.menu.find((m) => m.id === id) || {}).name || id + ' (removed)';
  const catName = (slug) => (admin.categories.find((c) => c.slug === slug) || {}).short || slug;
  const d = data;

  if (locked) return <div className="admin-panel insights" hidden={hidden}><InsightsLocked /></div>;

  return (
    <div className="admin-panel insights" hidden={hidden}>
      <div className="insights-head">
        <div className="chips" role="group" aria-label="Date range">
          {RANGES.map((r) => (
            <button key={r} type="button" className="chip chip-sm" aria-pressed={days === r} onClick={() => setDays(r)}>Last {r} days</button>
          ))}
        </div>
        <p className="tiny muted"><Icon name="shield" /> Anonymous: no cookies, no IP addresses stored. Visitors who ask not to be tracked aren't counted.</p>
      </div>
      {error && <p className="form-error">{error}</p>}
      {!d ? <p className="muted">Loading insights…</p> : (
        <div className={'insights-body' + (loading ? ' is-loading' : '')}>
          <div className="admin-kpis">
            <Kpi label="Visits" val={compact(d.totals.visits)} />
            <Kpi label="Page views" val={compact(d.totals.pageviews)} />
            <Kpi label="Orders" val={d.totals.orders} />
            <Kpi label="Visits that ordered" val={(d.totals.conversion * 100).toFixed(1) + '%'} />
            <Kpi label="Revenue" val={admin.money(d.totals.revenue)} />
          </div>

          <div className="insights-grid">
            <section className="panel-card wide">
              <h3>Visits per day</h3>
              <Columns data={d.daily.map((r) => ({ x: r.day, y: r.visits }))} xLabel={(r) => dayLabel(r.x)} valueName="visits" label="Visits per day" />
              <h3 className="mt-sm">Orders per day</h3>
              <Columns data={d.daily.map((r) => ({ x: r.day, y: r.orders }))} xLabel={(r) => dayLabel(r.x)} valueName="orders" label="Orders per day" height={130} />
              <details className="table-view">
                <summary>Show as table</summary>
                <Table head={['Day', 'Visits', 'Orders']} rows={d.daily.slice().reverse().map((r) => [dayLabel(r.day), r.visits, r.orders])} empty="" />
              </details>
            </section>

            <section className="panel-card">
              <h3>From visit to order</h3>
              <BarList unit="visits" max={d.funnel.visited} rows={[
                { label: 'Visited', value: d.funnel.visited },
                { label: 'Opened the menu', value: d.funnel.menu, note: pct(d.funnel.menu, d.funnel.visited) },
                { label: 'Added to cart', value: d.funnel.added, note: pct(d.funnel.added, d.funnel.visited) },
                { label: 'Opened the cart', value: d.funnel.cart, note: pct(d.funnel.cart, d.funnel.visited) },
                { label: 'Started checkout', value: d.funnel.checkout, note: pct(d.funnel.checkout, d.funnel.visited) },
                { label: 'Ordered', value: d.funnel.ordered, note: pct(d.funnel.ordered, d.funnel.visited) }
              ]} />
              <p className="tiny muted">Each visitor counts once per day. Percentages are of all visits.</p>
            </section>

            <section className="panel-card">
              <h3>Added to cart, but not ordered</h3>
              <Table head={['Dish', 'Added', 'Ordered', 'Ordered %']} empty="No add-to-cart activity yet."
                rows={d.items.slice().sort((a, b) => (a.ordered / (a.adds || 1)) - (b.ordered / (b.adds || 1)) || b.adds - a.adds).slice(0, 10)
                  .map((r) => [nameOf(r.itemId), r.adds, r.ordered, pct(Math.min(r.ordered, r.adds), r.adds)])} />
              <p className="tiny muted">Low % = people want it but stop. Check its price, photo or description.</p>
            </section>

            <section className="panel-card">
              <h3>Searches with no results</h3>
              <Table head={['Searched for', 'Times']} rows={d.emptySearches.map((r) => [r.query, r.times])} empty="None. Every search found something." />
              <p className="tiny muted">Ideas for new dishes, or words to add to descriptions.</p>
              <h3 className="mt-sm">Top searches</h3>
              <Table head={['Searched for', 'Times', 'Results']} rows={d.searches.map((r) => [r.query, r.times, r.results])} empty="No searches yet." />
            </section>

            <section className="panel-card wide">
              <h3>Busy hours <small>({d.timezone})</small></h3>
              <Columns data={d.hours.map((h) => ({ x: h.hour, y: h.visits }))} xLabel={(r) => String(r.x).padStart(2, '0') + ':00'} valueName="visits" label="Visits by hour of day" height={150} />
              <h3 className="mt-sm">Orders by hour</h3>
              <Columns data={d.hours.map((h) => ({ x: h.hour, y: h.orders }))} xLabel={(r) => String(r.x).padStart(2, '0') + ':00'} valueName="orders" label="Orders by hour of day" height={120} />
            </section>

            <section className="panel-card">
              <h3>Where visitors come from</h3>
              <BarList unit="visits" rows={d.referrers.map((r) => ({ label: r.referrer, value: r.visits }))} />
              {!d.referrers.length && <p className="tiny muted">Mostly direct visits (typed address, QR code, app links).</p>}
              <h3 className="mt-sm">First page they see</h3>
              <Table head={['Page', 'Visits']} rows={d.landing.map((r) => [r.path, r.visits])} empty="No visits yet." />
            </section>

            <section className="panel-card">
              <h3>Devices</h3>
              <BarList unit="visits" rows={d.devices.map((r) => ({ label: r.device[0].toUpperCase() + r.device.slice(1), value: r.visits, note: pct(r.visits, d.totals.visits) }))} />
              <h3 className="mt-sm">Menu sections opened</h3>
              <BarList unit="clicks" rows={d.categories.map((r) => ({ label: catName(r.category), value: r.clicks }))} />
              {!d.categories.length && <p className="tiny muted">No category clicks yet.</p>}
            </section>

            <section className="panel-card">
              <h3>Table QR codes</h3>
              <Table head={['Table', 'Scans', 'Orders']} rows={d.tables.map((r) => [r.table_no, r.scans, r.orders])} empty="No table scans yet. Print stickers in the QR codes tab." />
              <h3 className="mt-sm">Offer pop-up</h3>
              <BarList unit="times" max={d.promo.shown || 1} rows={[
                { label: 'Shown', value: d.promo.shown },
                { label: 'Code copied', value: d.promo.copied, note: pct(d.promo.copied, d.promo.shown) },
                { label: 'Code applied', value: d.promo.applied, note: pct(d.promo.applied, d.promo.shown) },
                { label: 'Orders with code', value: d.promo.orders, note: pct(d.promo.orders, d.promo.shown) }
              ]} />
            </section>

          </div>
        </div>
      )}
    </div>
  );
}
